import type { Slug, SourcePath } from "../models/ids.js";

export type ContentEntryKind = "page" | "meta";

/**
 * One file handed to the core. The first segment of `path` is the version folder.
 *
 * `meta` is opaque: the core reads directives out of it through the injected `readDirectives`
 * and otherwise never inspects it. That is what keeps framework concepts — compiled MDX,
 * `structuredData`, Fumadocs' `pages: []` navigation grammar — out of this package.
 */
export interface ContentEntry<M = unknown> {
  readonly path: SourcePath;
  readonly kind: ContentEntryKind;
  readonly meta: M;
  /** Explicit slug, version segment excluded. Falls back to `slugify(path)` when absent. */
  readonly slug?: Slug | undefined;
  /**
   * Opaque handle back to the host — an absolute path, a module id, anything. Carried through
   * untouched so an adapter can map a resolved page back to whatever it came from.
   */
  readonly origin?: string | undefined;
}

/**
 * Where content comes from. Deliberately **synchronous**: a Fumadocs `StaticSource` is already a
 * materialised array, and making this async would spread `await` across resolution, caching and
 * the dependency graph for no gain. A future filesystem source does its I/O before constructing
 * the entries.
 */
export interface ContentSource<M = unknown> {
  /** Stable identifier, useful when several sources feed one overlay. */
  readonly id?: string | undefined;
  entries(): Iterable<ContentEntry<M>>;
}
