import type { SlugKey, SourcePath, VersionId } from "../models/ids.js";
import type { OverlayDirectives, PageRef, ResolvedMeta } from "../models/page.js";
import type { LastAvailable, RedirectReason } from "../models/resolution.js";

/** A slug that serves a real file. `hops` is `0` when the version owns it. */
export interface PageEntry<M> {
  readonly kind: "page";
  readonly hops: number;
  readonly source: PageRef;
  readonly meta: M;
  readonly origin: string | undefined;
  readonly directives: OverlayDirectives;
}

/** A second slug for a page, served with a canonical pointing back at it. */
export interface AliasEntry {
  readonly kind: "alias";
  readonly target: SlugKey;
  readonly definedIn: VersionId;
  /** File whose frontmatter created this entry — the anchor for the dependency graph. */
  readonly declaredBy: SourcePath;
}

/** A slug that must not be served. Already collapsed to a terminal target. */
export interface RedirectEntry {
  readonly kind: "redirect";
  readonly to: SlugKey;
  readonly permanent: boolean;
  readonly reason: RedirectReason;
  readonly definedIn: VersionId;
  readonly declaredBy: SourcePath;
}

/** A slug removed by a tombstone. */
export interface DeletedEntry {
  readonly kind: "deleted";
  readonly deletedIn: VersionId;
  readonly lastAvailable: LastAvailable | undefined;
  readonly replacedBy: SlugKey | undefined;
  /** The tombstone file. One tombstone can account for a whole subtree. */
  readonly declaredBy: SourcePath;
}

export type IndexEntry<M> = PageEntry<M> | AliasEntry | RedirectEntry | DeletedEntry;

/**
 * The materialised state of one version: every slug it answers for, already folded. Looking a
 * slug up is a single `Map` read — the inheritance chain is walked once, when this is built, not
 * on every request.
 */
export interface VersionIndex<M> {
  readonly version: VersionId;
  readonly entries: ReadonlyMap<SlugKey, IndexEntry<M>>;
  /** Navigation metadata by directory, `""` being the version root. */
  readonly metas: ReadonlyMap<string, ResolvedMeta<M>>;
}
