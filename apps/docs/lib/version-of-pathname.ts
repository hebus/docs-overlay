import type { VersionTab } from "docs-overlay-fumadocs";

/**
 * Version a URL is reading.
 *
 * Derived in the browser rather than passed down from the layout: `app/docs/layout.tsx` has no
 * dynamic segment of its own — `[[...slug]]` sits below it — so it cannot tell which page it is
 * wrapping, and anything it computes from the overlay is the same on every route.
 *
 * Matched against the version URLs rather than by parsing segments: under `latestAtRoot` the release
 * has no segment of its own, so `/docs/authoring` is `0.1.0` while `/docs/next/authoring` is `next`.
 * Longest URL first, since `/docs` prefixes `/docs/next`.
 *
 * Off the documentation entirely — the landing page — answers with the latest version.
 */
export function versionOfPathname(pathname: string, tabs: readonly VersionTab[]): string | undefined {
  const match = [...tabs].sort((a, b) => b.url.length - a.url.length).find(tab => pathname === tab.url || pathname.startsWith(`${tab.url}/`));

  return (match ?? tabs.find(tab => tab.isLatest))?.version;
}
