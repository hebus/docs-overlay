import { loader } from "fumadocs-core/source";
import { docs } from "collections/server";

import { findOrphanPages, overlaySource } from "docs-overlay-fumadocs";

/**
 * This site is documented with the library it documents.
 *
 * `content/docs/0.1.0/` holds every page; `content/docs/next/` is empty and inherits all of them.
 * `latestAtRoot` keeps the release at `/docs/authoring` and puts the channel at
 * `/docs/next/authoring`, so cutting 0.1.0 broke no link and needed no change here.
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
