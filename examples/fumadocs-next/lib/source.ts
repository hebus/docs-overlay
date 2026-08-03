import { loader } from "fumadocs-core/source";
import { docs } from "collections/server";

import { findOrphanPages, overlaySource } from "docs-overlay-fumadocs";

/**
 * The whole integration. Compared with an unversioned Fumadocs site, this is the entire diff:
 * `docs.toFumadocsSource()` goes through `overlaySource()` first, and `loader()` gets `url`.
 */
export const overlay = overlaySource({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
  channels: ["next"],
  // `/docs/...` is the newest release and `/docs/1.0.0/...` an old one — the Docusaurus URL shape,
  // so migrating a site breaks no existing link.
  latestAtRoot: true,
  labels: { next: "Next 🚧" }
});

export const source = loader({
  baseUrl: "/docs",
  source: overlay.source,
  url: overlay.url
});

/** Surface content problems at build time instead of letting them ship quietly. */
export function reportDiagnostics(): void {
  for (const diagnostic of [...overlay.diagnostics, ...findOrphanPages(source)]) {
    // eslint-disable-next-line no-console
    console.log(`[docs-overlay] ${diagnostic.severity}: ${diagnostic.code} — ${diagnostic.message}`);
  }
}
