import { resolveRoute, switchVersion } from "docs-overlay-fumadocs";

import { overlay, source } from "./source";

/**
 * Which of a page's several URLs search engines should treat as the real one.
 *
 * Inheritance means one file is served by every version that does not override it, so
 * `/docs/authoring/`, `/docs/0.1.0/authoring/` and `/docs/next/authoring/` can be the same bytes at three
 * addresses. That is correct for readers and duplicate content for a crawler, which then splits whatever
 * authority the page has across three URLs and picks a winner itself — often an archived version.
 *
 * The rule is deliberately narrow: point at the root version **only when it serves the very same file**.
 * A version that overrides the page is different content and its own canonical; an older version that
 * owns a page the newest one has dropped is the only place that page exists at all.
 *
 * Returns `undefined` when the page is already its own canonical, which is also what makes it the test
 * for "should this URL be in the sitemap".
 */
export function canonicalUrlOf(slugs: readonly string[] | undefined): string | undefined {
  const route = resolveRoute(overlay, slugs);
  if (route.kind !== "page") return undefined;

  // An alias already knows its canonical: the adapter resolved it to the page's real slug.
  if (route.canonicalUrl !== undefined) return route.canonicalUrl;

  const root = overlay.root;
  if (root === undefined || route.version === root.id) return undefined;

  const target = switchVersion(overlay, slugs, root.id);
  if (!target.exact) return undefined;

  // Same file or not — the whole question. `absolutePath` is what the loader read it from, so two
  // versions serving one file agree on it. Absent, we say nothing rather than guess.
  const here = source.getPage(route.slugs)?.absolutePath;
  const there = source.getPage(target.slugs)?.absolutePath;
  if (here === undefined || there === undefined || here !== there) return undefined;

  return target.url;
}
