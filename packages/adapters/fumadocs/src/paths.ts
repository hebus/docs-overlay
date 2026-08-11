import type { Slug, SourcePath, Version, VersionId } from "docs-overlay";

/** Maps a version onto the URL segment that identifies it. Defaults to the folder name. */
export type VersionSegmentFn = (version: Version) => string;

export const defaultVersionSegment: VersionSegmentFn = version => version.id;

/**
 * `toFumadocsSource()` builds `absolutePath` with `path.join`, so on Windows it arrives with
 * backslashes. Anything used as a map key has to be normalised first, or the same file counts twice.
 */
export function slash(path: string): string {
  return path.replaceAll("\\", "/");
}

/**
 * Joins a base URL onto URL segments: `("/docs", "1.0.0", "guide")` → `"/docs/1.0.0/guide"`.
 *
 * A site whose documentation sits at the root — `baseUrl: "/"`, the shape Docusaurus calls
 * `routeBasePath: '/'` — is the reason this is not a template literal. `"/"` already ends in the
 * separator, so appending one more emits `//guide`, which a browser reads as protocol-relative and
 * resolves against a host named `guide`. Every URL the adapter hands back is built here, so the
 * whole surface — `loader({ url })`, canonicals, redirect targets, version landing pages — gets the
 * root case right at once.
 *
 * `baseUrl` is expected to arrive **already normalised** by `normaliseBaseUrl` — leading slash, no
 * trailing one — which is what lets `"/"` be the single special case here rather than one test per
 * shape. Internal on purpose: exported, it would need to defend that precondition itself, and a
 * caller passing a raw `"/docs/"` would get back the very doubled separator this closes.
 */
export function joinUrl(baseUrl: string, ...segments: readonly string[]): string {
  const parts = segments.filter(segment => segment !== "");
  if (parts.length === 0) return baseUrl;
  return `${baseUrl === "/" ? "" : baseUrl}/${parts.join("/")}`;
}

/** Replaces the leading version segment: `("1.0.0/guide/a.md", "3.0.0")` → `"3.0.0/guide/a.md"`. */
export function reSegment(path: SourcePath, segment: string): SourcePath {
  const normalised = slash(path).replace(/^\/+/, "");
  const index = normalised.indexOf("/");
  return index === -1 ? segment : `${segment}${normalised.slice(index)}`;
}

/**
 * Version segment prefixed by the scope, for a **path**: `("atomic", "2.0.0")` → `"atomic/2.0.0"`.
 *
 * A slash belongs in a path — it is a file key, and this is what keeps two documentations from
 * writing the same `2.0.0/meta.json` into one loader. It must never reach `slugs`, where a segment
 * containing a slash would be percent-encoded by the router; use {@link withSegment} there.
 */
export function scopedSegment(scope: string | undefined, segment: string): string {
  return scope === undefined || scope === "" ? segment : `${scope}/${segment}`;
}

/**
 * Slugs a page is served at: the scope when there is one, then the version segment. Set explicitly
 * rather than left to `slugsPlugin`: if the host uses `slugs` or `slugsFromData`, deriving them from
 * the original frontmatter would produce the *same* slug for every version and `slugsPlugin` throws
 * `Duplicated slugs`.
 */
export function withSegment(segment: string, slug: Slug, scope?: string | undefined): string[] {
  return scope === undefined || scope === "" ? [segment, ...slug] : [scope, segment, ...slug];
}

/** Drops the version segment from route slugs. */
export function stripVersion(slugs: readonly string[]): string[] {
  return slugs.slice(1);
}

/** First route segment, when there is one. */
export function versionOfSlugs(slugs: readonly string[] | undefined): VersionId | undefined {
  return slugs === undefined || slugs.length === 0 ? undefined : slugs[0];
}
