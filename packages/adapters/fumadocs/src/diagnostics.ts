import type { Diagnostic } from "@docs-overlay/core";
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
 */
export function versionTagOf(page: { readonly slugs: readonly string[] }): string | undefined {
  return versionOfSlugs(page.slugs);
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
