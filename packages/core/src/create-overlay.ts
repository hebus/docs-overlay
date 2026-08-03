import { createDependencyGraph, type DependencyGraph, type Dependent } from "./graph/dependency-graph.js";
import type { Diagnostic, DiagnosticSink } from "./models/diagnostic.js";
import type { DocumentationSource } from "./models/documentation-source.js";
import { parseSlugKey, splitVersionSegment, toSlugKey, type Slug, type SlugKey, type SourcePath, type VersionId } from "./models/ids.js";
import type { ResolvedMeta, ResolvedPage } from "./models/page.js";
import type { RedirectRule, Resolution } from "./models/resolution.js";
import type { Version, VersionOverrides } from "./models/version.js";
import { defaultReadDirectives, type ReadDirectivesFn } from "./resolve/directives.js";
import { foldVersion } from "./resolve/fold.js";
import type { IndexEntry, VersionIndex } from "./resolve/index-entry.js";
import { buildOwnIndexes, type OwnIndex } from "./resolve/own-index.js";
import { createSlugify, type SlugifyFn } from "./resolve/slugify.js";
import type { ContentEntry, ContentSource } from "./source/content-source.js";
import { chainOf, descendantsOf } from "./version/chain.js";
import { latestVersion, orderVersions } from "./version/order.js";
import { compareSemver, parseSemver } from "./version/semver.js";

export interface OverlayOptions<M = unknown> {
  /** A {@link ContentSource}, or the entries directly when that is more convenient. */
  readonly source: ContentSource<M> | readonly ContentEntry<M>[];
  /**
   * How to read overlay directives out of an entry's metadata. Defaults to its `overlay` key.
   * Injected so a framework with a different frontmatter convention needs no core change.
   */
  readonly readDirectives?: ReadDirectivesFn<M> | undefined;
  /**
   * Folder names that are not version numbers — typically `["next"]`. A declared channel exists as
   * a version even when its folder is empty, which is what makes cutting a release
   * (`git mv next 11.15.0 && mkdir next`) work immediately.
   */
  readonly channels?: readonly string[] | undefined;
  /** Replaces the default ordering (semver ascending, then channels) for every version. */
  readonly compareVersions?: ((a: VersionId, b: VersionId) => number) | undefined;
  /** Per-version `inheritsFrom` and opaque `meta`. This is how maintenance branches are declared. */
  readonly versions?: VersionOverrides | undefined;
  readonly slugify?: SlugifyFn | undefined;
  readonly pageExtensions?: readonly string[] | undefined;
  readonly onDiagnostic?: DiagnosticSink | undefined;
}

export interface VersionEntry {
  readonly slug: Slug;
  readonly kind: "page" | "alias" | "redirect" | "deleted";
}

export interface InvalidationResult {
  /** Versions whose index was thrown away. Everything they serve needs rebuilding. */
  readonly versions: readonly VersionId[];
  /** The individual entries that were reading the changed files, before and after. */
  readonly dependents: readonly Dependent[];
  /** `true` when the set of versions itself changed, so ordering and chains were recomputed. */
  readonly structural: boolean;
}

export interface Overlay<M = unknown> extends DocumentationSource<M> {
  /** Oldest first. */
  readonly versions: readonly Version[];
  /** Highest release: valid semver, no prerelease, not a channel. */
  readonly latest: Version | undefined;
  getVersion(id: VersionId): Version | undefined;
  /** From `id` towards the root of its inheritance chain. */
  getChain(id: VersionId): readonly Version[];
  /** `id` plus every version inheriting through it, transitively. */
  getDescendants(id: VersionId): readonly VersionId[];
  resolve(version: VersionId, slug: Slug | SlugKey): Resolution<M>;
  getMetas(version: VersionId): readonly ResolvedMeta<M>[];
  getMeta(version: VersionId, dir: string): ResolvedMeta<M> | undefined;
  getRedirects(version?: VersionId): readonly RedirectRule[];
  /**
   * Every slug a version answers for, page or not.
   *
   * An adapter needs this to enumerate routes: a removed page, an alias and an old slug are all
   * addressable, yet none of them is in {@link getPages}.
   */
  getEntries(version: VersionId): readonly VersionEntry[];
  /**
   * Everything whose resolution reads `path`. Materialises the overlay, since a dependency that has
   * not been folded yet cannot be known.
   */
  getDependents(path: SourcePath): readonly Dependent[];
  /**
   * Re-reads the source and drops the affected indexes, returning what the change touched.
   *
   * The impact is measured against the **current** state before it is discarded: for a deleted
   * file, asking afterwards would return the new — empty — answer, and a dev server would never
   * learn which routes to refresh. Call with no argument to rebuild everything.
   */
  invalidate(paths?: Iterable<SourcePath>): InvalidationResult;
  /**
   * Every problem found in the content. Materialises the overlay, so it is complete — nothing is
   * reported lazily and then missed.
   */
  diagnostics(): readonly Diagnostic[];
  /** Number of version folds performed so far. Exposed so memoisation is testable. */
  readonly foldCount: number;
}

interface State<M> {
  readonly versions: readonly Version[];
  readonly byId: Map<VersionId, Version>;
  readonly latest: Version | undefined;
  readonly ownIndexes: ReadonlyMap<VersionId, OwnIndex<M>>;
  readonly indexes: Map<VersionId, VersionIndex<M>>;
  readonly graph: DependencyGraph<M>;
  readonly diagnostics: Diagnostic[];
  folds: number;
}

/**
 * Builds an overlay over a set of version folders.
 *
 * Never throws on bad content: problems are reported as {@link Diagnostic}s. A broken page must not
 * take down a dev server — deciding whether an `error` diagnostic should fail a build is the
 * caller's call.
 */
export function createOverlay<M = unknown>(options: OverlayOptions<M>): Overlay<M> {
  const slugify = options.slugify ?? createSlugify(options.pageExtensions);
  const readDirectives = options.readDirectives ?? defaultReadDirectives;

  const buildState = (): State<M> => {
    const diagnostics: Diagnostic[] = [];
    const onDiagnostic: DiagnosticSink = diagnostic => {
      diagnostics.push(diagnostic);
      options.onDiagnostic?.(diagnostic);
    };

    const entries = Array.isArray(options.source) ? options.source : [...(options.source as ContentSource<M>).entries()];
    const ownIndexes = buildOwnIndexes<M>(entries, { slugify, readDirectives, onDiagnostic });
    const versions = orderVersions(discoverVersionIds(ownIndexes, options.channels), {
      channels: options.channels,
      compareVersions: options.compareVersions,
      overrides: options.versions,
      onDiagnostic
    });

    return {
      versions,
      byId: new Map(versions.map(version => [version.id, version])),
      latest: latestVersion(versions),
      ownIndexes,
      indexes: new Map(),
      graph: createDependencyGraph<M>(),
      diagnostics,
      folds: 0
    };
  };

  let state = buildState();

  /** Folds a version on demand, recursing into its parent first. Memoised per version. */
  const indexOf = (current: State<M>, id: VersionId): VersionIndex<M> | undefined => {
    const cached = current.indexes.get(id);
    if (cached !== undefined) return cached;

    const version = current.byId.get(id);
    if (version === undefined) return undefined;

    const parent = version.inheritsFrom === undefined ? undefined : indexOf(current, version.inheritsFrom);
    const onDiagnostic: DiagnosticSink = diagnostic => {
      current.diagnostics.push(diagnostic);
      options.onDiagnostic?.(diagnostic);
    };

    const built = foldVersion<M>(version, parent, current.ownIndexes.get(id), { onDiagnostic });
    current.indexes.set(id, built);
    current.folds += 1;
    current.graph.record(built);
    return built;
  };

  const materialise = (current: State<M>, ids?: Iterable<VersionId>): void => {
    for (const id of ids ?? current.versions.map(version => version.id)) indexOf(current, id);
  };

  const pageOf = (version: VersionId, entry: IndexEntry<M>): ResolvedPage<M> | undefined => {
    if (entry.kind !== "page") return undefined;
    return {
      version,
      slug: entry.source.slug,
      source: entry.source,
      meta: entry.meta,
      origin: entry.origin,
      inherited: entry.hops > 0,
      hops: entry.hops
    };
  };

  const resolve = (version: VersionId, slug: Slug | SlugKey): Resolution<M> => {
    const index = indexOf(state, version);
    if (index === undefined) {
      const nearest = nearestVersion(state, version);
      return nearest === undefined ? { kind: "unknown-version" } : { kind: "unknown-version", nearest };
    }

    const entry = index.entries.get(toSlugKey(slug));
    if (entry === undefined) return { kind: "missing" };

    switch (entry.kind) {
      case "page": {
        const page = pageOf(version, entry);
        if (page === undefined) return { kind: "missing" };
        return entry.hops === 0 ? { kind: "own", page } : { kind: "inherited", page };
      }
      case "alias": {
        const target = index.entries.get(entry.target);
        const page = target === undefined ? undefined : pageOf(version, target);
        if (page === undefined) return { kind: "missing" };
        return { kind: "alias", page, canonical: page.slug };
      }
      case "redirect":
        return { kind: "redirect", to: parseSlugKey(entry.to), permanent: entry.permanent, reason: entry.reason };
      case "deleted":
        return {
          kind: "deleted",
          deletedIn: entry.deletedIn,
          ...(entry.lastAvailable === undefined ? {} : { lastAvailable: entry.lastAvailable }),
          ...(entry.replacedBy === undefined ? {} : { replacedBy: parseSlugKey(entry.replacedBy) })
        };
    }
  };

  const getPages = (version: VersionId): readonly ResolvedPage<M>[] => {
    const index = indexOf(state, version);
    if (index === undefined) return [];

    const pages: ResolvedPage<M>[] = [];
    for (const entry of index.entries.values()) {
      // Aliases and redirects are extra slugs for a page that is already listed here; adding them
      // would duplicate every aliased page.
      const page = pageOf(version, entry);
      if (page !== undefined) pages.push(page);
    }
    return pages;
  };

  const invalidate = (paths?: Iterable<SourcePath>): InvalidationResult => {
    const requested = paths === undefined ? undefined : [...paths];
    const previous = state;

    // The old state has to be complete before it is discarded, or a deleted file's dependents are
    // simply lost.
    materialise(previous);
    const before = requested === undefined ? allDependents(previous) : requested.flatMap(path => previous.graph.get(path));

    state = buildState();

    const affected = new Set<VersionId>();
    for (const dependent of before) affected.add(dependent.version);

    if (requested === undefined) {
      for (const version of previous.versions) affected.add(version.id);
      for (const version of state.versions) affected.add(version.id);
    } else {
      // A file that was added or removed is absent from one of the two graphs, so fall back to the
      // structural answer: its own version plus everything downstream.
      for (const path of requested) {
        const { version } = splitVersionSegment(path);
        for (const id of descendantsOf(previous.versions, version)) affected.add(id);
        for (const id of descendantsOf(state.versions, version)) affected.add(id);
      }
    }

    const structural = !sameVersionIds(previous.versions, state.versions);
    if (structural) {
      for (const version of previous.versions) affected.add(version.id);
      for (const version of state.versions) affected.add(version.id);
    }

    // Fold only what changed, so the graph can answer for newly added files too.
    materialise(state, affected);
    const after = requested === undefined ? allDependents(state) : requested.flatMap(path => state.graph.get(path));

    return {
      versions: [...affected],
      dependents: dedupeDependents([...before, ...after]),
      structural
    };
  };

  return {
    get versions() {
      return state.versions;
    },
    get latest() {
      return state.latest;
    },
    get foldCount() {
      return state.folds;
    },
    getVersions: () => state.versions,
    getVersion: id => state.byId.get(id),
    getChain: id => chainOf(state.versions, id),
    getDescendants: id => descendantsOf(state.versions, id),
    resolve,
    getPages,
    getPage: (version, slug) => {
      const result = resolve(version, slug);
      return result.kind === "own" || result.kind === "inherited" || result.kind === "alias" ? result.page : undefined;
    },
    getMetas: version => [...(indexOf(state, version)?.metas.values() ?? [])],
    getMeta: (version, dir) => indexOf(state, version)?.metas.get(dir),
    getRedirects: version => {
      const scope = version === undefined ? state.versions.map(entry => entry.id) : [version];
      const rules: RedirectRule[] = [];
      for (const id of scope) {
        const index = indexOf(state, id);
        if (index === undefined) continue;
        for (const [key, entry] of index.entries) {
          if (entry.kind !== "redirect") continue;
          rules.push({ version: id, from: parseSlugKey(key), to: parseSlugKey(entry.to), permanent: entry.permanent, reason: entry.reason });
        }
      }
      return rules;
    },
    getEntries: version => {
      const index = indexOf(state, version);
      if (index === undefined) return [];
      return [...index.entries].map(([key, entry]) => ({ slug: parseSlugKey(key), kind: entry.kind }));
    },
    getDependents: path => {
      materialise(state);
      return state.graph.get(path);
    },
    invalidate,
    diagnostics: () => {
      materialise(state);
      return state.diagnostics;
    }
  };
}

/**
 * Version folders come from the content itself. Declared channels are added even when empty, so a
 * freshly cut `next/` inherits everything instead of 404ing.
 */
function discoverVersionIds<M>(ownIndexes: ReadonlyMap<VersionId, OwnIndex<M>>, channels: readonly string[] | undefined): Set<VersionId> {
  const ids = new Set<VersionId>(ownIndexes.keys());
  for (const channel of channels ?? []) ids.add(channel);
  return ids;
}

/** Best existing version to send a reader to when the one they asked for is gone. */
function nearestVersion<M>(state: State<M>, requested: VersionId): VersionId | undefined {
  const parts = parseSemver(requested);
  if (parts === undefined) return state.latest?.id;

  let best: Version | undefined;
  let oldestReleased: Version | undefined;
  for (const version of state.versions) {
    if (version.semver === undefined) continue;
    oldestReleased ??= version;
    if (compareSemver(version.semver, parts) <= 0) best = version;
  }

  return (best ?? oldestReleased ?? state.latest)?.id;
}

function allDependents<M>(current: State<M>): Dependent[] {
  const all: Dependent[] = [];
  for (const index of current.indexes.values()) {
    for (const [key, entry] of index.entries) {
      all.push({ kind: entry.kind, version: index.version, slug: parseSlugKey(key) });
    }
    for (const dir of index.metas.keys()) all.push({ kind: "meta", version: index.version, dir });
  }
  return all;
}

function dedupeDependents(dependents: readonly Dependent[]): Dependent[] {
  const seen = new Map<string, Dependent>();
  for (const dependent of dependents) {
    const tail = dependent.kind === "meta" ? dependent.dir : dependent.slug.join("/");
    seen.set(`${dependent.kind} ${dependent.version} ${tail}`, dependent);
  }
  return [...seen.values()];
}

function sameVersionIds(a: readonly Version[], b: readonly Version[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((version, index) => version.id === b[index]?.id);
}
