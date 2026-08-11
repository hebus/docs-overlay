/**
 * Turning N full snapshots into an overlay.
 *
 * A framework that versions documentation by copying the whole tree leaves behind one complete folder
 * per release. This plans the conversion: which files a version has nothing to say about and can drop,
 * which slugs moved, which disappeared, and which of those calls a machine has no business making
 * alone.
 *
 * It belongs to the engine rather than to a migration tool because "what does this version actually
 * change" is the same question the resolver answers at read time, asked in reverse.
 */

import type { Diagnostic, DiagnosticSink } from "../models/diagnostic.js";
import type { Slug, SlugKey, VersionId } from "../models/ids.js";
import { slugKey, toSlugKey } from "../models/ids.js";
import type { SlugifyFn } from "../resolve/slugify.js";
import { createSlugify, DEFAULT_PAGE_EXTENSIONS, dirOf } from "../resolve/slugify.js";
import type { CandidateInput, CandidateThresholds, CandidateWeights, RenameCandidate } from "./rename-candidates.js";
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, rankCandidates, replacementSuggestions } from "./rename-candidates.js";
import type { Comparable } from "./similarity.js";
import { comparable } from "./similarity.js";

/** One file of one snapshot. */
export interface SnapshotFile {
  /** Path relative to the snapshot root, extension included: `"guide/api.mdx"`. */
  readonly path: string;
  /**
   * Digest of the raw bytes. The caller computes it, and the engine only ever compares digests for
   * equality — which is what decides whether a version has anything to say about a page. Comparing
   * bytes rather than text is deliberate: a difference that is only a line ending is still a
   * difference, and pretending otherwise would silently rewrite files during a migration.
   */
  readonly digest: string;
  /** Read on demand, so a snapshot of a few hundred files is not held in memory to be mostly unused. */
  readonly read: () => string;
  /** Frontmatter title, if the caller parsed one. The engine never parses YAML. */
  readonly title?: string | undefined;
}

/** One version's complete tree, as the framework being migrated away from stored it. */
export interface Snapshot {
  readonly version: VersionId;
  readonly files: readonly SnapshotFile[];
}

export type SnapshotStep =
  /** Oldest snapshot: kept whole, it is what everything else inherits from. */
  | { readonly kind: "base"; readonly version: VersionId; readonly path: string }
  /** Differs from what it would inherit, so it stays. */
  | { readonly kind: "override"; readonly version: VersionId; readonly path: string; readonly inheritedFrom: VersionId }
  /** A slug this version introduces. */
  | { readonly kind: "add"; readonly version: VersionId; readonly path: string }
  /** Byte-identical to what it would inherit, so it goes. */
  | { readonly kind: "prune"; readonly version: VersionId; readonly path: string; readonly inheritedFrom: VersionId }
  /** Identical to what it inherits, but kept because it carries a directive that would be lost. */
  | { readonly kind: "pin"; readonly version: VersionId; readonly path: string; readonly why: string }
  /** Gets `overlay.renamedFrom`, so the old slug keeps answering. */
  | { readonly kind: "rename"; readonly version: VersionId; readonly path: string; readonly from: readonly SlugKey[] }
  /** A tombstone file to write at a slug that disappeared. */
  | {
      readonly kind: "tombstone";
      readonly version: VersionId;
      readonly slug: Slug;
      /** Path to write it at, taken from the file that used to be there so the extension matches. */
      readonly path: string;
      readonly recursive: boolean;
      readonly replacedBy?: SlugKey | undefined;
      /** Newest version that still serves the page. What a "removed in X" page should cite. */
      readonly lastAvailable: VersionId;
    };

/** A vanished slug the engine refuses to decide alone. */
export interface SnapshotQuestion {
  readonly version: VersionId;
  readonly slug: Slug;
  /** Ranked. Ineligible entries are kept, because they are exactly the `replacedBy` suggestions. */
  readonly candidates: readonly RenameCandidate[];
  /** Slugs worth offering as `replacedBy`, most likely first. */
  readonly suggestions: readonly SlugKey[];
  /** What the engine would do if forced to proceed unattended. */
  readonly fallback: SnapshotStep;
}

/** A recorded answer. Replayed answers always win over the heuristic, which is what makes a plan reproducible. */
export type SnapshotDecision =
  | { readonly kind: "rename"; readonly version: VersionId; readonly slug: SlugKey; readonly to: SlugKey }
  | { readonly kind: "delete"; readonly version: VersionId; readonly slug: SlugKey; readonly replacedBy?: SlugKey | undefined };

export interface SnapshotStats {
  readonly base: number;
  readonly overrides: number;
  readonly additions: number;
  readonly pruned: number;
  readonly pinned: number;
  readonly renames: number;
  readonly tombstones: number;
  readonly questions: number;
  /** Files the migration commits, against the number the snapshots held. */
  readonly filesAfter: number;
  readonly filesBefore: number;
}

export interface SnapshotPlan {
  readonly steps: readonly SnapshotStep[];
  readonly questions: readonly SnapshotQuestion[];
  readonly stats: SnapshotStats;
  readonly diagnostics: readonly Diagnostic[];
}

export interface SnapshotPlanOptions {
  readonly weights?: Partial<CandidateWeights> | undefined;
  readonly thresholds?: Partial<CandidateThresholds> | undefined;
  /** Drop files identical to what they inherit. Off leaves a faithful copy of every snapshot. */
  readonly prune?: boolean | undefined;
  /** How many tombstones in one directory before a single recursive one replaces them. */
  readonly recursiveMin?: number | undefined;
  readonly decisions?: readonly SnapshotDecision[] | undefined;
  readonly pageExtensions?: readonly string[] | undefined;
  readonly slugify?: SlugifyFn | undefined;
  readonly onDiagnostic?: DiagnosticSink | undefined;
}

interface Indexed {
  readonly version: VersionId;
  /** slug key → the file serving it in this snapshot's own folder. */
  readonly own: Map<SlugKey, SnapshotFile>;
}

/**
 * Plans the conversion of `snapshots`, **oldest first**.
 *
 * Never throws: a corpus problem is a {@link Diagnostic}, exactly as it is everywhere else in the
 * engine. A migration that aborts on the first oddity is a migration nobody finishes.
 */
export function planSnapshots(snapshots: readonly Snapshot[], options: SnapshotPlanOptions = {}): SnapshotPlan {
  const diagnostics: Diagnostic[] = [];
  const report = (diagnostic: Diagnostic): void => {
    diagnostics.push(diagnostic);
    options.onDiagnostic?.(diagnostic);
  };

  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
  const prune = options.prune ?? true;
  const recursiveMin = options.recursiveMin ?? 2;
  const slugify = options.slugify ?? createSlugify(options.pageExtensions ?? DEFAULT_PAGE_EXTENSIONS);

  const steps: SnapshotStep[] = [];
  const questions: SnapshotQuestion[] = [];
  let filesBefore = 0;

  const indexed: Indexed[] = snapshots.map(snapshot => {
    const own = new Map<SlugKey, SnapshotFile>();
    filesBefore += snapshot.files.length;
    for (const file of snapshot.files) {
      const key = slugKey(slugify(file.path));
      const existing = own.get(key);
      if (existing !== undefined) {
        // Two files claiming one slug — `a.md` beside `a.mdx`, typically. Whichever wins, one of them
        // stops being reachable, and that is a decision the corpus has to make, not this planner.
        report({
          code: "duplicate-slug",
          severity: "error",
          message: `${snapshot.version}: "${existing.path}" and "${file.path}" both resolve to the slug "${key}".`,
          version: snapshot.version,
          slug: slugify(file.path)
        });
        continue;
      }
      own.set(key, file);
    }
    return { version: snapshot.version, own };
  });

  if (indexed.length === 0) {
    return { steps, questions, stats: emptyStats(), diagnostics };
  }

  // The oldest snapshot is the base: kept whole, because there is nothing behind it to inherit from.
  const base = indexed[0]!;
  for (const file of base.own.values()) steps.push({ kind: "base", version: base.version, path: file.path });

  // Folded view of everything the previous versions serve, so an override is measured against what the
  // reader would actually get rather than against the immediately preceding folder. Without this, a page
  // last changed three versions ago looks like an addition.
  const folded = new Map<SlugKey, { file: SnapshotFile; definedIn: VersionId }>();
  for (const [key, file] of base.own) folded.set(key, { file, definedIn: base.version });

  const decisions = new Map<string, SnapshotDecision>();
  for (const decision of options.decisions ?? []) decisions.set(`${decision.version}\u0000${decision.slug}`, decision);

  for (const current of indexed.slice(1)) {
    const renamesByPath = new Map<string, SlugKey[]>();
    const tombstones: SnapshotStep[] = [];

    // Which slugs this version keeps quiet about. Sorted so a plan is byte-reproducible between runs.
    const goneKeys = [...folded.keys()].filter(key => !current.own.has(key)).sort();

    const bodies = new Map<SlugKey, Comparable>();
    const bodyOf = (key: SlugKey, file: SnapshotFile): Comparable => {
      let body = bodies.get(key);
      if (body === undefined) {
        body = comparable(file.read(), file.title);
        bodies.set(key, body);
      }
      return body;
    };

    for (const key of goneKeys) {
      const previous = folded.get(key)!;
      const goneBody = bodyOf(`${previous.definedIn}\u0000${key}`, previous.file);
      const goneSlug = slugify(previous.file.path);

      const candidates: CandidateInput[] = [];
      for (const [candidateKey, file] of current.own) {
        const existedInParent = folded.has(candidateKey);
        // An unchanged inherited page is not a candidate for anything: it is not new, and it is not
        // where a reader of the vanished slug was sent. Only slugs this version adds, plus slugs it
        // overrides, are worth scoring — and the latter only as `replacedBy`.
        if (existedInParent && folded.get(candidateKey)!.file.digest === file.digest) continue;
        candidates.push({
          slug: slugify(file.path),
          path: file.path,
          body: bodyOf(`${current.version}\u0000${candidateKey}`, file),
          existedInParent
        });
      }

      const ranking = rankCandidates(goneBody, goneSlug, candidates, weights, thresholds);
      const decided = decisions.get(`${current.version}\u0000${key}`);

      const asTombstone = (replacedBy?: SlugKey | undefined): SnapshotStep => ({
        kind: "tombstone",
        version: current.version,
        slug: goneSlug,
        path: previous.file.path,
        recursive: false,
        ...(replacedBy === undefined ? {} : { replacedBy }),
        lastAvailable: previous.definedIn
      });

      if (decided !== undefined) {
        if (decided.kind === "rename") {
          const target = current.own.get(decided.to);
          if (target === undefined) {
            report({
              code: "redirect-target-missing",
              severity: "error",
              message: `${current.version}: recorded decision renames "${key}" to "${decided.to}", which this version does not provide.`,
              version: current.version,
              slug: goneSlug
            });
            tombstones.push(asTombstone());
          } else {
            push(renamesByPath, target.path, key);
          }
        } else {
          tombstones.push(asTombstone(decided.replacedBy));
        }
        continue;
      }

      if (ranking.accepted !== undefined) {
        push(renamesByPath, ranking.accepted.path, key);
        continue;
      }

      if (ranking.verdict === "ask") {
        questions.push({
          version: current.version,
          slug: goneSlug,
          candidates: ranking.candidates,
          suggestions: replacementSuggestions(ranking.candidates),
          fallback: asTombstone()
        });
        continue;
      }

      tombstones.push(asTombstone());
    }

    // A directory that loses every page it had, and gains none, is better expressed once.
    const collapsed = collapseRecursive(tombstones, recursiveMin, folded, current);

    for (const [key, file] of current.own) {
      const inherited = folded.get(key);
      const renamedFrom = renamesByPath.get(file.path);

      if (renamedFrom !== undefined) {
        steps.push({ kind: "rename", version: current.version, path: file.path, from: renamedFrom.sort() });
      } else if (inherited === undefined) {
        steps.push({ kind: "add", version: current.version, path: file.path });
      } else if (inherited.file.digest !== file.digest) {
        steps.push({ kind: "override", version: current.version, path: file.path, inheritedFrom: inherited.definedIn });
      } else if (prune) {
        steps.push({ kind: "prune", version: current.version, path: file.path, inheritedFrom: inherited.definedIn });
      } else {
        steps.push({ kind: "pin", version: current.version, path: file.path, why: "pruning disabled" });
      }

      folded.set(key, { file, definedIn: current.version });
    }

    // Tombstones land after the version's own files so a reader of the plan sees what it says before
    // what it takes away, and `folded` is updated here so later versions inherit the absence.
    for (const step of [...collapsed, ...tombstones]) {
      steps.push(step);
      if (step.kind !== "tombstone") continue;
      folded.delete(slugKey(step.slug));
      if (!step.recursive) continue;
      // `recursive` removes the subtree under the tombstone's *folder*, which is what the directive
      // means — not the subtree under its slug, which for an index page would be a different set.
      const prefix = dirOf(step.path) === "" ? "" : `${dirOf(step.path)}/`;
      if (prefix === "") continue;
      // Deleting from a Map while iterating its keys is well defined: entries already visited or not
      // yet reached are handled, and a key removed before it is reached is simply never visited.
      for (const other of folded.keys()) if (other.startsWith(prefix)) folded.delete(other);
    }
  }

  return { steps, questions, stats: statsOf(steps, questions, filesBefore), diagnostics };
}

function push(map: Map<string, SlugKey[]>, key: string, value: SlugKey): void {
  const existing = map.get(key);
  if (existing === undefined) map.set(key, [value]);
  else existing.push(value);
}

/**
 * Replaces a group of tombstones with one recursive tombstone, but only when the whole directory really
 * goes: every slug the parent served under it is gone, and this version adds nothing there. Recursing
 * on a directory that also gained a page would tombstone something live.
 */
function collapseRecursive(
  tombstones: SnapshotStep[],
  recursiveMin: number,
  folded: Map<SlugKey, { file: SnapshotFile; definedIn: VersionId }>,
  current: Indexed
): readonly SnapshotStep[] {
  if (recursiveMin <= 0 || tombstones.length < recursiveMin) return [];

  const byDirectory = new Map<string, SnapshotStep[]>();
  for (const step of tombstones) {
    if (step.kind !== "tombstone") continue;
    const directory = dirOf(step.path);
    const group = byDirectory.get(directory);
    if (group === undefined) byDirectory.set(directory, [step]);
    else group.push(step);
  }

  const collapsed: SnapshotStep[] = [];
  for (const [directory, group] of byDirectory) {
    if (directory === "" || group.length < recursiveMin) continue;

    const parentHadUnder = [...folded.keys()].filter(key => key.startsWith(`${directory}/`)).length;
    const currentAddsUnder = [...current.own.values()].some(file => dirOf(file.path) === directory || dirOf(file.path).startsWith(`${directory}/`));
    if (currentAddsUnder || group.length !== parentHadUnder) continue;

    // The alphabetically first file carries it, so the choice is reproducible.
    const sorted = [...group].sort((a, b) => (a.kind === "tombstone" && b.kind === "tombstone" ? a.path.localeCompare(b.path) : 0));
    const carrier = sorted[0]!;
    if (carrier.kind !== "tombstone") continue;

    collapsed.push({ ...carrier, recursive: true });
    for (const step of group) {
      const index = tombstones.indexOf(step);
      if (index !== -1) tombstones.splice(index, 1);
    }
  }
  return collapsed;
}

function statsOf(steps: readonly SnapshotStep[], questions: readonly SnapshotQuestion[], filesBefore: number): SnapshotStats {
  const count = (kind: SnapshotStep["kind"]): number => steps.filter(step => step.kind === kind).length;
  const pruned = count("prune");
  const tombstones = count("tombstone");
  return {
    base: count("base"),
    overrides: count("override"),
    additions: count("add"),
    pruned,
    pinned: count("pin"),
    renames: count("rename"),
    tombstones,
    questions: questions.length,
    filesAfter: steps.length - pruned,
    filesBefore
  };
}

function emptyStats(): SnapshotStats {
  return {
    base: 0,
    overrides: 0,
    additions: 0,
    pruned: 0,
    pinned: 0,
    renames: 0,
    tombstones: 0,
    questions: 0,
    filesAfter: 0,
    filesBefore: 0
  };
}

/** Convenience for a caller holding slugs rather than keys. */
export function decisionKey(version: VersionId, slug: Slug | SlugKey): string {
  return `${version}\u0000${toSlugKey(slug)}`;
}
