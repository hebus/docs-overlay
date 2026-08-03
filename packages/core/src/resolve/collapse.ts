import type { DiagnosticSink } from "../models/diagnostic.js";
import { parseSlugKey, type SlugKey, type VersionId } from "../models/ids.js";
import type { DeletedEntry, IndexEntry } from "./index-entry.js";

/**
 * Rewrites every redirect and alias so it points straight at a page, then removes the ones that
 * lead nowhere.
 *
 * Doing this once, when the index is built, is what makes `resolve()` terminal: a caller never has
 * to follow a second hop, and a cycle can never become an infinite loop at request time.
 */
export function collapseIndirections<M>(entries: Map<SlugKey, IndexEntry<M>>, version: VersionId, onDiagnostic?: DiagnosticSink): void {
  const handled = new Set<SlugKey>();

  // Snapshot on purpose: the loop rewrites and deletes entries as it goes, and iterating the live
  // map would make it depend on insertion order during mutation.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const [key, entry] of [...entries]) {
    if (handled.has(key) || (entry.kind !== "redirect" && entry.kind !== "alias")) continue;
    handled.add(key);

    const outcome = follow(entries, key);

    switch (outcome.kind) {
      case "page":
        if (entry.kind === "alias") entries.set(key, { ...entry, target: outcome.key });
        else entries.set(key, { ...entry, to: outcome.key, reason: outcome.hops > 1 ? "chained" : entry.reason });
        break;

      case "deleted":
        // The page moved and was then removed. Answering with the removal — which carries where it
        // last existed and what replaced it — beats redirecting a reader onto a 404.
        entries.set(key, outcome.entry);
        break;

      case "cycle":
        // Drop the whole cycle at once, so its other members are not reported a second time as
        // pointing at something missing.
        for (const member of outcome.chain) {
          handled.add(member);
          const memberEntry = entries.get(member);
          if (memberEntry?.kind === "redirect" || memberEntry?.kind === "alias") entries.delete(member);
        }
        onDiagnostic?.({
          code: "redirect-cycle",
          severity: "error",
          message: `Redirect cycle in version "${version}": ${outcome.chain.join(" -> ")} -> ${outcome.chain[0] ?? key}. Those slugs now resolve to nothing.`,
          version,
          slug: parseSlugKey(key)
        });
        break;

      case "missing":
        onDiagnostic?.({
          code: "redirect-target-missing",
          severity: "error",
          message: `"${key}" in version "${version}" points at "${outcome.target}", which no page provides.`,
          version,
          slug: parseSlugKey(key)
        });
        entries.delete(key);
        break;
    }
  }
}

type Outcome =
  | { readonly kind: "page"; readonly key: SlugKey; readonly hops: number }
  | { readonly kind: "deleted"; readonly entry: DeletedEntry }
  | { readonly kind: "cycle"; readonly chain: readonly SlugKey[] }
  | { readonly kind: "missing"; readonly target: SlugKey };

/** Walks the indirection chain from `start` until it reaches something terminal. */
function follow<M>(entries: ReadonlyMap<SlugKey, IndexEntry<M>>, start: SlugKey): Outcome {
  const chain: SlugKey[] = [start];
  const seen = new Set<SlugKey>(chain);
  let current = start;

  for (;;) {
    const entry = entries.get(current);
    if (entry === undefined) return { kind: "missing", target: current };

    let next: SlugKey;
    switch (entry.kind) {
      case "page":
        return { kind: "page", key: current, hops: chain.length - 1 };
      case "redirect":
        next = entry.to;
        break;
      case "alias":
        next = entry.target;
        break;
      case "deleted":
        // A tombstone naming a replacement is worth following; one that names nothing is terminal,
        // and one that points back into the chain stops here rather than looping.
        if (entry.replacedBy === undefined || seen.has(entry.replacedBy)) return { kind: "deleted", entry };
        next = entry.replacedBy;
        break;
    }

    if (seen.has(next)) return { kind: "cycle", chain };
    seen.add(next);
    chain.push(next);
    current = next;
  }
}
