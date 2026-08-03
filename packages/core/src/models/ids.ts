/** Name of a top-level version folder, e.g. `"11.14.0"` or `"next"`. */
export type VersionId = string;

/** Page slug **without** the version segment, e.g. `["guide", "api"]`. */
export type Slug = readonly string[];

/** A {@link Slug} joined with `/`. The canonical `Map` key for a page inside a version. */
export type SlugKey = string;

/**
 * POSIX path of a file relative to the content root, first segment being the version:
 * `"11.14.0/guide/api.mdx"`. Also the identity used by the dependency graph.
 */
export type SourcePath = string;

const SEPARATOR = "/";

export function slugKey(slug: Slug): SlugKey {
  return slug.join(SEPARATOR);
}

export function parseSlugKey(key: SlugKey): Slug {
  return key === "" ? [] : key.split(SEPARATOR);
}

/** Accepts either representation, so callers never have to normalise at the call site. */
export function toSlug(value: Slug | SlugKey): Slug {
  return typeof value === "string" ? parseSlugKey(value) : value;
}

/** Accepts either representation and returns the `Map` key. */
export function toSlugKey(value: Slug | SlugKey): SlugKey {
  return typeof value === "string" ? value : slugKey(value);
}

/** Splits `"11.14.0/guide/api.mdx"` into its version segment and the rest. */
export function splitVersionSegment(path: SourcePath): { version: VersionId; rest: string } {
  const normalised = path.replace(/^\/+/, "");
  const index = normalised.indexOf(SEPARATOR);
  if (index === -1) return { version: normalised, rest: "" };
  return { version: normalised.slice(0, index), rest: normalised.slice(index + 1) };
}

/** Rewrites a path into another version's space: `("11.13.0/a.md", "11.14.0")` → `"11.14.0/a.md"`. */
export function withVersionSegment(path: SourcePath, version: VersionId): SourcePath {
  const { rest } = splitVersionSegment(path);
  return rest === "" ? version : `${version}${SEPARATOR}${rest}`;
}
