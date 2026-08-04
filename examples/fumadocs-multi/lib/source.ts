import { loader } from "fumadocs-core/source";
import { docs } from "collections/server";

import { findOrphanPages, overlaySource, type OverlaySource } from "docs-overlay-fumadocs";

/**
 * Two products, each versioned on its own, served by **one** `loader()`.
 *
 * One loader rather than one per product, because the loader owns the file system that
 * `createRelativeLink()` reads: split it and a relative link stops resolving. Keeping one also means
 * one page tree and one search index.
 *
 * The scope is what makes that safe. Without it both products would emit `1.0.0/guide/shared.md` and
 * `meta.json`, and whichever was registered second would silently win.
 */
const content = () => docs.toFumadocsSource();

export const alpha = overlaySource({ source: content, baseUrl: "/docs", scope: "alpha", channels: ["next"], latestAtRoot: true });
export const beta = overlaySource({ source: content, baseUrl: "/docs", scope: "beta", channels: ["next"], latestAtRoot: true });

export const overlays: readonly OverlaySource[] = [alpha, beta];

/** The documentation a request belongs to: its scope is the first segment. */
export function overlayOf(slugs: readonly string[] | undefined): OverlaySource | undefined {
  return overlays.find(overlay => overlay.scope === slugs?.[0]);
}

export const source = loader({
  baseUrl: "/docs",
  // A record, not a single source: the loader writes them all into one file system, and the scoped
  // paths keep them apart.
  source: { alpha: alpha.source, beta: beta.source },
  // Each product drops its own root version's segment, so the URL has to be built by the overlay the
  // slugs belong to.
  url: slugs => (overlayOf(slugs) ?? alpha).url(slugs)
});

/** Fails the build on a content problem rather than shipping it — for every product. */
export function reportDiagnostics(): void {
  const problems = [...overlays.flatMap(overlay => overlay.diagnostics), ...findOrphanPages(source)];

  for (const problem of problems) {
    console.log(`[docs-overlay] ${problem.severity}: ${problem.code} — ${problem.message}`);
  }

  const errors = problems.filter(problem => problem.severity === "error");
  if (errors.length > 0) throw new Error(`${errors.length} content error(s); see the log above.`);
}
