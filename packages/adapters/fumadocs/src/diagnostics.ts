import type { Diagnostic } from "docs-overlay";
import type { Node, Root } from "fumadocs-core/page-tree";

import { versionOfSlugs } from "./paths.js";

/** The slice of a `LoaderOutput` these helpers need, so no generic has to be threaded through. */
export interface PageTreeReader {
  getPageTree(locale?: string): Root;
  getPages(locale?: string): readonly { readonly url: string; readonly slugs: readonly string[] }[];
}

/**
 * Version segment of a page.
 *
 * Search needs it: a page served by five versions produces five index entries pointing at the same
 * `structuredData`, so an unfiltered query returns five copies of it. Tag the index with this and
 * filter on the client.
 *
 * On a **scoped** source the first segment is the documentation, not the version — use
 * {@link searchTagsOf} there.
 */
export function versionTagOf(page: { readonly slugs: readonly string[] }): string | undefined {
  return versionOfSlugs(page.slugs);
}

/** The slice of an `OverlaySource` {@link searchTagsOf} needs. */
export interface ScopeReader {
  readonly scope: string | undefined;
}

/**
 * Tags for one search index entry: the version, preceded by the documentation when a site serves
 * several. `tag` accepts an array, and a query can then narrow on either or both.
 *
 * Prefer this to {@link versionTagOf} as soon as a scope exists. Reading the first slug segment would
 * then yield the product, so a query meaning "this version" would silently filter on "this product" —
 * every version of it, which is the very duplication the tag was added to remove.
 */
export function searchTagsOf(source: ScopeReader, page: { readonly slugs: readonly string[] }): string[] {
  if (source.scope === undefined) {
    const version = versionOfSlugs(page.slugs);
    return version === undefined ? [] : [version];
  }

  // The slugs always carry the version, even where the URL drops it — so it is right after the scope.
  const version = page.slugs[1];
  return version === undefined ? [source.scope] : [source.scope, version];
}

/**
 * Pages that are routed but that no navigation tree reaches — the classic consequence of inheriting
 * a `meta.json` whose `pages` list is exhaustive.
 *
 * Computed by comparing the routed pages against the tree rather than by reading `root.fallback`:
 * Fumadocs appends its fallback transformer *after* every plugin transformer, so a plugin never sees
 * a populated `fallback`.
 */
export function findOrphanPages(output: PageTreeReader, locale?: string): Diagnostic[] {
  const reachable = new Set<string>();
  collectUrls(output.getPageTree(locale), reachable);

  return output
    .getPages(locale)
    .filter(page => !reachable.has(page.url))
    .map(page => ({
      code: "orphan-page" as const,
      severity: "warning" as const,
      message: `"${page.url}" is routed but no navigation tree reaches it. Inheriting a \`meta.json\` with an exhaustive \`pages\` list is the usual cause.`,
      ...(versionTagOf(page) === undefined ? {} : { version: versionTagOf(page) })
    }));
}

function collectUrls(node: Root | Node, into: Set<string>): void {
  if ("type" in node && node.type === "page") {
    into.add(node.url);
    return;
  }
  if ("type" in node && node.type === "separator") return;

  if ("index" in node && node.index !== undefined) into.add(node.index.url);
  for (const child of node.children ?? []) collectUrls(child, into);
  // A version folder's own subtree is reachable through the same walk; `fallback` deliberately is
  // not, since that is precisely the set of unreachable pages.
}
