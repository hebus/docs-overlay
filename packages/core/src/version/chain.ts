import type { VersionId } from "../models/ids.js";
import type { Version } from "../models/version.js";

/**
 * The inheritance chain of `id`, starting with `id` itself and walking towards the root of its
 * chain. `chainOf(versions, "next")` on a linear set returns `[next, 3.0.0, 1.0.0]`.
 */
export function chainOf(versions: readonly Version[], id: VersionId): readonly Version[] {
  const byId = index(versions);
  const chain: Version[] = [];
  const seen = new Set<VersionId>();

  let current = byId.get(id);
  while (current !== undefined && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.inheritsFrom === undefined ? undefined : byId.get(current.inheritsFrom);
  }

  return chain;
}

/**
 * Versions in an order where every parent precedes its children, which is what the fold needs.
 * A plain sort by `order` is not enough: an explicit `inheritsFrom` may point at a version that
 * sorts later, and the core stays agnostic about which direction the overlay runs in.
 */
export function foldOrder(versions: readonly Version[]): readonly Version[] {
  const byId = index(versions);
  const emitted = new Set<VersionId>();
  const result: Version[] = [];

  const visit = (version: Version, path: Set<VersionId>): void => {
    if (emitted.has(version.id) || path.has(version.id)) return;
    path.add(version.id);

    const parent = version.inheritsFrom === undefined ? undefined : byId.get(version.inheritsFrom);
    if (parent !== undefined) visit(parent, path);

    if (!emitted.has(version.id)) {
      emitted.add(version.id);
      result.push(version);
    }
  };

  for (const version of versions) visit(version, new Set());

  return result;
}

/**
 * Every version whose resolution reads `id` — `id` itself plus everything that inherits through
 * it, transitively. This is what turns "this file changed" into "these versions must be rebuilt".
 */
export function descendantsOf(versions: readonly Version[], id: VersionId): readonly VersionId[] {
  const children = new Map<VersionId, VersionId[]>();
  for (const version of versions) {
    if (version.inheritsFrom === undefined) continue;
    const siblings = children.get(version.inheritsFrom);
    if (siblings === undefined) children.set(version.inheritsFrom, [version.id]);
    else siblings.push(version.id);
  }

  const result: VersionId[] = [];
  const seen = new Set<VersionId>();
  const queue: VersionId[] = [id];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    result.push(current);
    queue.push(...(children.get(current) ?? []));
  }

  // `id` itself is only a descendant if it exists.
  return versions.some(version => version.id === id) ? result : [];
}

function index(versions: readonly Version[]): Map<VersionId, Version> {
  return new Map(versions.map(version => [version.id, version]));
}
