import { loader } from "fumadocs-core/source";
import { docs } from "collections/server";

import { findOrphanPages, overlaySource } from "docs-overlay-fumadocs";

/**
 * This site is documented with the library it documents.
 *
 * The oldest version folder holds every page; each newer one holds only what it rewrote, and
 * `content/docs/next/` holds whatever an unreleased change has touched — often nothing.
 *
 * `latestAtRoot` keeps the newest release at `/docs/authoring` and puts the channel at
 * `/docs/next/authoring`, so cutting a version breaks no link and needs no change here. The cut
 * itself is done by `scripts/cut-docs.mjs` when the engine's version is bumped.
 */
export const overlay = overlaySource({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
  channels: ["next"],
  latestAtRoot: true,
  labels: { next: "Unreleased" }
});

export const source = loader({
  baseUrl: "/docs",
  source: overlay.source,
  url: overlay.url
});

/** Fails the build on a content problem rather than shipping it. */
export function reportDiagnostics(): void {
  const problems = [...overlay.diagnostics, ...findOrphanPages(source)];

  for (const problem of problems) {
    console.log(`[docs-overlay] ${problem.severity}: ${problem.code} — ${problem.message}`);
  }

  const errors = problems.filter(problem => problem.severity === "error");
  if (errors.length > 0) throw new Error(`${errors.length} content error(s); see the log above.`);
}
