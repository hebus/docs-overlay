import type { DiagnosticSink } from "../models/diagnostic.js";
import type { VersionId } from "../models/ids.js";
import type { Version, VersionOverrides } from "../models/version.js";
import { compareSemver, parseSemver, type SemverParts } from "./semver.js";

export interface OrderVersionsOptions {
  /**
   * Folder names that are allowed not to be version numbers, in the order they should sit
   * **after** every released version. A non-semver folder that is not listed here is ignored,
   * with an `unknown-version-folder` diagnostic — never a silent surprise.
   */
  readonly channels?: readonly string[] | undefined;
  /**
   * Replaces the default comparator (semver ascending, then channels in declaration order) for
   * every accepted id. Return a negative number when `a` is older than `b`.
   */
  readonly compareVersions?: ((a: VersionId, b: VersionId) => number) | undefined;
  readonly overrides?: VersionOverrides | undefined;
  readonly onDiagnostic?: DiagnosticSink | undefined;
}

interface Classified {
  readonly id: VersionId;
  readonly semver: SemverParts | undefined;
  readonly channel: string | undefined;
  readonly channelRank: number;
}

/**
 * Turns a set of version folder names into the ordered, validated chain the resolver folds along.
 * Returned oldest first, so index `0` is the base holding the complete tree.
 */
export function orderVersions(ids: Iterable<VersionId>, options: OrderVersionsOptions = {}): readonly Version[] {
  const channels = options.channels ?? [];
  const accepted = classify(ids, channels, options.onDiagnostic);
  const sorted = sort(accepted, options.compareVersions, options.onDiagnostic);

  const versions = sorted.map<Version>((entry, index) => ({
    id: entry.id,
    order: index,
    semver: entry.semver,
    channel: entry.channel,
    inheritsFrom: index === 0 ? undefined : sorted[index - 1]?.id,
    meta: options.overrides?.[entry.id]?.meta
  }));

  return applyInheritanceOverrides(versions, options.overrides, options.onDiagnostic);
}

/** Highest released version: valid semver, no prerelease, not a channel. */
export function latestVersion(versions: readonly Version[]): Version | undefined {
  for (let index = versions.length - 1; index >= 0; index -= 1) {
    const version = versions[index];
    if (version !== undefined && version.semver !== undefined && version.semver[3] === undefined) return version;
  }
  // No stable release — fall back to the newest prerelease, still excluding channels.
  for (let index = versions.length - 1; index >= 0; index -= 1) {
    const version = versions[index];
    if (version !== undefined && version.semver !== undefined) return version;
  }
  return undefined;
}

function classify(ids: Iterable<VersionId>, channels: readonly string[], onDiagnostic: DiagnosticSink | undefined): Classified[] {
  const seen = new Set<VersionId>();
  const accepted: Classified[] = [];

  for (const id of ids) {
    if (id === "" || seen.has(id)) continue;
    seen.add(id);

    const semver = parseSemver(id);
    if (semver !== undefined) {
      accepted.push({ id, semver, channel: undefined, channelRank: -1 });
      continue;
    }

    const channelRank = channels.indexOf(id);
    if (channelRank === -1) {
      onDiagnostic?.({
        code: "unknown-version-folder",
        severity: "warning",
        message: `Folder "${id}" is neither a version number nor a declared channel, so it is ignored. Add it to \`channels\` to treat it as an unreleased version.`,
        version: id
      });
      continue;
    }

    accepted.push({ id, semver: undefined, channel: id, channelRank });
  }

  return accepted;
}

function sort(
  entries: Classified[],
  compareVersions: ((a: VersionId, b: VersionId) => number) | undefined,
  onDiagnostic: DiagnosticSink | undefined
): Classified[] {
  const compare =
    compareVersions === undefined
      ? (a: Classified, b: Classified) => defaultCompare(a, b, onDiagnostic)
      : (a: Classified, b: Classified) => compareVersions(a.id, b.id);

  // Sort a copy: callers keep ownership of what they passed in.
  return [...entries].sort(compare);
}

function defaultCompare(a: Classified, b: Classified, onDiagnostic: DiagnosticSink | undefined): number {
  // Channels are the work-in-progress tip, so they sit after every released version.
  if (a.semver === undefined && b.semver === undefined) return a.channelRank - b.channelRank;
  if (a.semver === undefined) return 1;
  if (b.semver === undefined) return -1;

  const result = compareSemver(a.semver, b.semver);
  if (result !== 0) return result;

  // e.g. `2` and `2.0.0` side by side. Fall back to the id so the order is at least stable.
  onDiagnostic?.({
    code: "ambiguous-version-order",
    severity: "warning",
    message: `Versions "${a.id}" and "${b.id}" compare as equal; ordering them by folder name. Rename one of them.`,
    version: a.id
  });
  return a.id < b.id ? -1 : 1;
}

function applyInheritanceOverrides(
  versions: readonly Version[],
  overrides: VersionOverrides | undefined,
  onDiagnostic: DiagnosticSink | undefined
): readonly Version[] {
  const byId = new Map(versions.map(version => [version.id, version]));
  const parents = new Map(versions.map(version => [version.id, version.inheritsFrom]));

  if (overrides !== undefined) {
    for (const [id, override] of Object.entries(overrides)) {
      if (override.inheritsFrom === undefined || !byId.has(id)) continue;

      if (!byId.has(override.inheritsFrom)) {
        onDiagnostic?.({
          code: "inherits-from-unknown",
          severity: "error",
          message: `Version "${id}" declares \`inheritsFrom: "${override.inheritsFrom}"\`, which does not exist. Falling back to the default chain.`,
          version: id
        });
        continue;
      }

      parents.set(id, override.inheritsFrom);
    }
  }

  breakCycles(versions, parents, onDiagnostic);

  return versions.map(version => ({ ...version, inheritsFrom: parents.get(version.id) }));
}

function breakCycles(versions: readonly Version[], parents: Map<VersionId, VersionId | undefined>, onDiagnostic: DiagnosticSink | undefined): void {
  const safe = new Set<VersionId>();

  for (const version of versions) {
    const path = new Set<VersionId>();
    let current: VersionId | undefined = version.id;

    while (current !== undefined && !safe.has(current)) {
      if (path.has(current)) {
        onDiagnostic?.({
          code: "inheritance-cycle",
          severity: "error",
          message: `Inheritance cycle through "${current}" (${[...path].join(" -> ")}); cutting the chain there.`,
          version: current
        });
        parents.set(current, undefined);
        break;
      }
      path.add(current);
      current = parents.get(current);
    }

    for (const id of path) safe.add(id);
  }
}
