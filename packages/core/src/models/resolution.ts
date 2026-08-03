import type { Slug, VersionId } from "./ids.js";
import type { ResolvedPage } from "./page.js";

export type RedirectReason =
  /** The page moved: the old slug is declared in the new file's `renamedFrom`. */
  | "renamed"
  /** The page is gone and its tombstone names a `replacedBy` target. */
  | "replaced"
  /** Collapsed from a chain of the two above. */
  | "chained";

/** Where a page was last available before it was removed. */
export interface LastAvailable {
  readonly version: VersionId;
  readonly slug: Slug;
}

/**
 * Outcome of asking a version for a slug. Exhaustive and terminal: redirect chains are collapsed
 * when the index is built, so `to` always names something servable and the caller never loops.
 *
 * Each branch carries only its own fields, so a `switch` is checked by the compiler and adapters
 * need no defensive `if (result.page)`.
 */
export type Resolution<M = unknown> =
  /** A file in this version's own folder. */
  | { readonly kind: "own"; readonly page: ResolvedPage<M> }
  /** A file inherited from somewhere up the chain. */
  | { readonly kind: "inherited"; readonly page: ResolvedPage<M> }
  /** Served at this slug, but `canonical` is the page's real slug. */
  | { readonly kind: "alias"; readonly page: ResolvedPage<M>; readonly canonical: Slug }
  /** Do not serve; send the reader to `to`. */
  | { readonly kind: "redirect"; readonly to: Slug; readonly permanent: boolean; readonly reason: RedirectReason }
  /**
   * Removed in `deletedIn`. Rich on purpose: knowing where it last existed and what replaced it
   * lets an adapter answer with an explanation instead of a bare 404.
   */
  | {
      readonly kind: "deleted";
      readonly deletedIn: VersionId;
      readonly lastAvailable?: LastAvailable | undefined;
      readonly replacedBy?: Slug | undefined;
    }
  /** The version exists but has never had this page. */
  | { readonly kind: "missing" }
  /**
   * The version itself does not exist — a different situation from `missing`, which is why it is
   * a separate branch: this one wants a hard 404 or a redirect to `nearest`, not a fallback to
   * the version landing page.
   */
  | { readonly kind: "unknown-version"; readonly nearest?: VersionId | undefined };

export interface RedirectRule {
  readonly version: VersionId;
  /** Slugs, never URLs: building URLs needs `baseUrl`, `basePath` and `trailingSlash` — all adapter concerns. */
  readonly from: Slug;
  readonly to: Slug;
  readonly permanent: boolean;
  readonly reason: RedirectReason;
}
