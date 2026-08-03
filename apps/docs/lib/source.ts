import { loader } from "fumadocs-core/source";
import { docs } from "collections/server";

import { findOrphanPages, overlaySource } from "docs-overlay-fumadocs";

/**
 * This site is documented with the library it documents.
 *
 * Only `content/docs/next/` exists today, because only one release does. `latestAtRoot` is on all the
 * same, so the URLs are already `/docs/authoring` rather than `/docs/next/authoring` — and when 0.2.0
 * ships, `git mv content/docs/next content/docs/0.2.0 && mkdir content/docs/next` grows a second
 * version without touching a single page or a single line here.
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
