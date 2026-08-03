import type { VersionId } from "@docs-overlay/core";

import type { OverlaySource } from "./overlay-source.js";
import type { VersionInfo } from "./version-info.js";

export type RouteResolution =
  /** Serve the page. `canonicalUrl` is set when the request came in through an alias. */
  | { readonly kind: "page"; readonly version: VersionId; readonly slugs: string[]; readonly canonicalUrl?: string | undefined }
  /** Do not serve; send the reader to `to`. */
  | { readonly kind: "redirect"; readonly to: string; readonly permanent: boolean }
  /** The page existed and was removed. Enough context to explain instead of 404ing. */
  | {
      readonly kind: "gone";
      readonly version: VersionId;
      readonly deletedIn: VersionId;
      readonly lastAvailableUrl?: string | undefined;
      readonly replacedByUrl?: string | undefined;
    }
  | { readonly kind: "not-found" };

/**
 * Turns the route params of `app/docs/[[...slug]]/page.tsx` into a decision.
 *
 * The version is the first segment. With `latestAtRoot`, a first segment that is not a known version
 * means the request is for the newest release, whose segment is implicit in the URL but still present
 * in the slugs the loader knows.
 */
export function resolveRoute(source: OverlaySource, segments: readonly string[] | undefined): RouteResolution {
  const requested = segments ?? [];
  const fromSegment = requested.length === 0 ? undefined : source.versionOfSegment(requested[0] ?? "");

  const version = fromSegment ?? implicitVersion(source);
  if (version === undefined) return { kind: "not-found" };

  const rest = fromSegment === undefined ? requested : requested.slice(1);
  const result = source.overlay.resolve(version.id, rest);

  switch (result.kind) {
    case "own":
    case "inherited":
      return { kind: "page", version: version.id, slugs: [version.segment, ...rest] };

    case "alias":
      // Served, but the canonical link must point at the page's real slug.
      return {
        kind: "page",
        version: version.id,
        slugs: [version.segment, ...result.page.slug],
        canonicalUrl: source.url([version.segment, ...result.canonical])
      };

    case "redirect":
      return { kind: "redirect", to: source.url([version.segment, ...result.to]), permanent: result.permanent };

    case "deleted":
      return {
        kind: "gone",
        version: version.id,
        deletedIn: result.deletedIn,
        ...(result.lastAvailable === undefined ? {} : { lastAvailableUrl: lastAvailableUrl(source, result.lastAvailable.version, result.lastAvailable.slug) }),
        ...(result.replacedBy === undefined ? {} : { replacedByUrl: source.url([version.segment, ...result.replacedBy]) })
      };

    case "missing":
    case "unknown-version":
      return { kind: "not-found" };
  }
}

/** Only the newest release can be addressed without a segment, and only when asked for. */
function implicitVersion(source: OverlaySource): VersionInfo | undefined {
  return source.latest?.url === source.baseUrl ? source.latest : undefined;
}

function lastAvailableUrl(source: OverlaySource, version: VersionId, slug: readonly string[]): string | undefined {
  const info = source.versionOf(version);
  return info === undefined ? undefined : source.url([info.segment, ...slug]);
}

export interface VersionSwitch {
  readonly slugs: string[];
  readonly url: string;
  /** `false` when the target version has no such page and the reader lands on its home page. */
  readonly exact: boolean;
}

/**
 * Where the version switcher should go from the page the reader is on.
 *
 * The hard case is the one worth getting right: switching from `/docs/3.0.0/guide/a` to a version
 * that never had `guide/a`. Falling back to that version's landing page with `exact: false` lets the
 * UI say so, instead of showing a 404 after a click the reader could not have known would fail.
 */
export function switchVersion(source: OverlaySource, segments: readonly string[] | undefined, to: VersionId): VersionSwitch {
  const target = source.versionOf(to);
  if (target === undefined) return { slugs: [], url: source.baseUrl, exact: false };

  const current = resolveRoute(source, segments);
  const slug = current.kind === "page" ? current.slugs.slice(1) : [];

  // Landing page to landing page is an exact match, not a fallback.
  if (slug.length === 0) return { slugs: [target.segment], url: target.url, exact: true };

  const resolved = source.overlay.resolve(to, slug);
  const exists = resolved.kind === "own" || resolved.kind === "inherited" || resolved.kind === "alias";
  if (!exists) return { slugs: [target.segment], url: target.url, exact: false };

  return { slugs: [target.segment, ...slug], url: source.url([target.segment, ...slug]), exact: true };
}
