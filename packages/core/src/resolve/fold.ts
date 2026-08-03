import type { DiagnosticSink } from "../models/diagnostic.js";
import { parseSlugKey, slugKey, withVersionSegment, type SlugKey } from "../models/ids.js";
import type { ResolvedMeta } from "../models/page.js";
import type { Version } from "../models/version.js";
import { collapseIndirections } from "./collapse.js";
import type { IndexEntry, VersionIndex } from "./index-entry.js";
import type { OwnIndex, OwnPage } from "./own-index.js";

export interface FoldContext {
  readonly onDiagnostic?: DiagnosticSink | undefined;
}

/**
 * Builds one version's materialised index by overlaying its own folder on top of its parent's
 * **already-folded index** — not on top of the parent's folder.
 *
 * That single detail is what makes multi-hop inheritance free: a page defined in `1.0.0` and never
 * touched again shows up in `6.0.0` with the right `hops` and the right defining version, with no
 * recursion at lookup time. Delete-then-re-add needs no special case either, since an own file
 * simply overwrites whatever was inherited.
 *
 * Steps run in a fixed priority order — own file, tombstone, rename, alias, inherited — so that
 * "I renamed onto a slug that already exists" has one predictable answer instead of two.
 */
export function foldVersion<M>(
  version: Version,
  parent: VersionIndex<M> | undefined,
  own: OwnIndex<M> | undefined,
  context: FoldContext = {}
): VersionIndex<M> {
  const entries = inheritEntries<M>(parent);

  const files = [...(own?.pages.values() ?? [])];
  const tombstones = files.filter(file => file.directives.deleted === true);
  const pages = files.filter(file => file.directives.deleted !== true);
  // A slug backed by a file in this version — tombstone included — can never be taken over by a
  // rename or an alias.
  const claimed = new Set(files.map(file => slugKey(file.slug)));

  applyPages(entries, version, pages);
  applyTombstones(entries, version, tombstones, context.onDiagnostic);
  applyRenames(entries, version, pages, claimed, context.onDiagnostic);
  applyAliases(entries, version, pages, claimed, context.onDiagnostic);
  collapseIndirections(entries, version.id, context.onDiagnostic);

  return {
    version: version.id,
    entries,
    metas: foldMetas(version, parent, own)
  };
}

/**
 * Flat copy of the parent's index, with owned pages demoted to inherited. Non-page entries —
 * tombstones, redirects, aliases — are carried through unchanged, which is what makes a redirect
 * declared in `3.0.0` still work in `4.0.0` instead of turning back into a 404.
 */
function inheritEntries<M>(parent: VersionIndex<M> | undefined): Map<SlugKey, IndexEntry<M>> {
  const entries = new Map<SlugKey, IndexEntry<M>>();
  if (parent === undefined) return entries;

  for (const [key, entry] of parent.entries) {
    entries.set(key, entry.kind === "page" ? { ...entry, hops: entry.hops + 1 } : entry);
  }
  return entries;
}

function applyPages<M>(entries: Map<SlugKey, IndexEntry<M>>, version: Version, pages: readonly OwnPage<M>[]): void {
  for (const page of pages) {
    entries.set(slugKey(page.slug), {
      kind: "page",
      hops: 0,
      source: { definedIn: version.id, path: page.path, slug: page.slug },
      meta: page.meta,
      origin: page.origin,
      directives: page.directives
    });
  }
}

/**
 * A tombstone is a file at the slug it removes, living in the version that removes it. The
 * deletion version therefore comes from the file's own path — there is no version string to write
 * and nothing that can drift out of sync.
 */
function applyTombstones<M>(
  entries: Map<SlugKey, IndexEntry<M>>,
  version: Version,
  tombstones: readonly OwnPage<M>[],
  onDiagnostic: DiagnosticSink | undefined
): void {
  for (const tombstone of tombstones) {
    const key = slugKey(tombstone.slug);
    const targets = tombstone.directives.recursive === true ? [key, ...subtreeOf(entries, key)] : [key];

    if (entries.get(key) === undefined) {
      onDiagnostic?.({
        code: "tombstone-without-target",
        severity: "warning",
        message: `"${tombstone.path}" marks "${key}" as deleted, but nothing in the inheritance chain of "${version.id}" provides that page.`,
        version: version.id,
        path: tombstone.path,
        slug: tombstone.slug
      });
    }

    for (const target of targets) {
      const previous = entries.get(target);

      // Already removed further up the chain: the earlier deletion is the truthful one.
      if (previous?.kind === "deleted") continue;

      entries.set(target, {
        kind: "deleted",
        deletedIn: version.id,
        // The newest version that still serves it is this version's parent, which is where a
        // "last available in ..." link should point.
        lastAvailable:
          previous?.kind === "page" && version.inheritsFrom !== undefined ? { version: version.inheritsFrom, slug: parseSlugKey(target) } : undefined,
        replacedBy: target === key ? tombstone.directives.replacedBy : undefined,
        declaredBy: tombstone.path
      });
    }
  }
}

/** Slugs nested under `key`, e.g. `guide/legacy/a` for `guide/legacy`. */
function subtreeOf<M>(entries: ReadonlyMap<SlugKey, IndexEntry<M>>, key: SlugKey): SlugKey[] {
  const prefix = key === "" ? "" : `${key}/`;
  const nested: SlugKey[] = [];
  for (const candidate of entries.keys()) {
    if (candidate !== key && candidate.startsWith(prefix)) nested.push(candidate);
  }
  return nested;
}

function applyRenames<M>(
  entries: Map<SlugKey, IndexEntry<M>>,
  version: Version,
  pages: readonly OwnPage<M>[],
  claimed: ReadonlySet<SlugKey>,
  onDiagnostic: DiagnosticSink | undefined
): void {
  for (const page of pages) {
    const target = slugKey(page.slug);
    for (const from of page.directives.renamedFrom ?? []) {
      if (from === target) {
        onDiagnostic?.({
          code: "rename-collision",
          severity: "warning",
          message: `"${page.path}" declares \`renamedFrom: "${from}"\`, which is its own slug; ignoring it.`,
          version: version.id,
          path: page.path,
          slug: page.slug
        });
        continue;
      }

      if (claimed.has(from)) {
        onDiagnostic?.({
          code: "rename-collision",
          severity: "error",
          message: `"${page.path}" declares \`renamedFrom: "${from}"\`, but version "${version.id}" also has a file at that slug; the file wins.`,
          version: version.id,
          path: page.path,
          slug: parseSlugKey(from)
        });
        continue;
      }

      entries.set(from, { kind: "redirect", to: target, permanent: true, reason: "renamed", definedIn: version.id, declaredBy: page.path });
    }
  }
}

function applyAliases<M>(
  entries: Map<SlugKey, IndexEntry<M>>,
  version: Version,
  pages: readonly OwnPage<M>[],
  claimed: ReadonlySet<SlugKey>,
  onDiagnostic: DiagnosticSink | undefined
): void {
  for (const page of pages) {
    const target = slugKey(page.slug);
    for (const alias of page.directives.aliases ?? []) {
      if (alias === target) continue;

      const existing = entries.get(alias);
      // An alias is an *extra* slug for a page. It must never shadow a page — inherited included:
      // taking a slug away from real content requires a real file or a tombstone, not an alias.
      if (claimed.has(alias) || existing?.kind === "page" || (existing?.kind === "redirect" && existing.definedIn === version.id)) {
        onDiagnostic?.({
          code: "alias-collision",
          severity: "error",
          message: `"${page.path}" declares the alias "${alias}", which version "${version.id}" already serves; ignoring the alias.`,
          version: version.id,
          path: page.path,
          slug: parseSlugKey(alias)
        });
        continue;
      }

      entries.set(alias, { kind: "alias", target, definedIn: version.id, declaredBy: page.path });
    }
  }
}

/**
 * Metadata files are inherited whole, per directory — never merged field by field. Understanding
 * what is inside one (Fumadocs' `pages: []` grammar, for instance) is an adapter's job.
 */
function foldMetas<M>(version: Version, parent: VersionIndex<M> | undefined, own: OwnIndex<M> | undefined): Map<string, ResolvedMeta<M>> {
  const metas = new Map<string, ResolvedMeta<M>>();

  if (parent !== undefined) {
    for (const [dir, meta] of parent.metas) {
      metas.set(dir, {
        version: version.id,
        dir,
        // Rewritten into the browsing version's space so the adapter can emit it as a real file there.
        path: withVersionSegment(meta.source.path, version.id),
        source: meta.source,
        meta: meta.meta,
        origin: meta.origin,
        inherited: true
      });
    }
  }

  if (own !== undefined) {
    for (const [dir, meta] of own.metas) {
      metas.set(dir, {
        version: version.id,
        dir,
        path: meta.path,
        source: { definedIn: version.id, path: meta.path, slug: [] },
        meta: meta.meta,
        origin: meta.origin,
        inherited: false
      });
    }
  }

  return metas;
}
