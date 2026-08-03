import type { Slug, SlugKey, VersionId } from "./ids.js";
import type { ResolvedPage } from "./page.js";
import type { Version } from "./version.js";

/**
 * The stable contract adapters are written against. Deliberately tiny: an adapter that only needs
 * to list and look up pages should not have to know about the rest of the engine, and this
 * interface is what lets a new framework integration be added without touching the core.
 */
export interface DocumentationSource<M = unknown> {
  /** Oldest first, so index `0` is the base holding the complete tree. */
  getVersions(): readonly Version[];
  getPages(version: VersionId): readonly ResolvedPage<M>[];
  getPage(version: VersionId, slug: Slug | SlugKey): ResolvedPage<M> | undefined;
}
