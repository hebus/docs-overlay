import type { Slug, SlugKey, SourcePath, VersionId } from "./ids.js";

/**
 * The `overlay:` block a page carries in its frontmatter. Every directive is expressed **in the
 * version that introduces the change**, so a published version folder is never edited again.
 */
export interface OverlayDirectives {
  /**
   * Marks this file as a **tombstone**: the page it shadows stops existing from this version
   * onwards. The version is derived from the file's own path, so there is nothing to keep in sync.
   */
  readonly deleted?: boolean | undefined;
  /** With `deleted`, removes the whole subtree under this page's folder, not just the page. */
  readonly recursive?: boolean | undefined;
  /** Slugs this page used to live at. Each one becomes a permanent redirect to this page. */
  readonly renamedFrom?: readonly SlugKey[] | undefined;
  /** Extra slugs that serve this page directly, with a canonical pointing back at it. */
  readonly aliases?: readonly SlugKey[] | undefined;
  /** Where a reader should go instead. Turns a bare 404 into a useful answer. */
  readonly replacedBy?: SlugKey | undefined;
}

/** Lightweight, serialisable pointer to a file that really exists on disk. */
export interface PageRef {
  /** Version whose folder physically contains the file. */
  readonly definedIn: VersionId;
  /** Path of that file, in **its own** version's space. */
  readonly path: SourcePath;
  readonly slug: Slug;
}

/** A page as seen from one version. */
export interface ResolvedPage<M = unknown> {
  /** Version being browsed. Differs from `source.definedIn` whenever `inherited` is true. */
  readonly version: VersionId;
  readonly slug: Slug;
  readonly source: PageRef;
  /**
   * The source's metadata, passed **by reference** — never cloned. Sharing it is what lets a
   * bundler emit one chunk for a page served by several versions.
   */
  readonly meta: M;
  /** The source's opaque handle to the physical file — an absolute path, a module id, anything. */
  readonly origin: string | undefined;
  readonly inherited: boolean;
  /** Number of inheritance hops from the version that defines the file. `0` when owned. */
  readonly hops: number;
}

/** A navigation metadata file as seen from one version. */
export interface ResolvedMeta<M = unknown> {
  readonly version: VersionId;
  /** Directory the file governs, relative to the version root. `""` is the version root. */
  readonly dir: string;
  /** Path rewritten into the browsing version's space. */
  readonly path: SourcePath;
  readonly source: PageRef;
  readonly meta: M;
  readonly origin: string | undefined;
  readonly inherited: boolean;
}
