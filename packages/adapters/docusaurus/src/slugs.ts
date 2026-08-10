/**
 * Docusaurus has two identifier spaces, and they do not coincide.
 *
 * Sidebars reference **doc ids**; URLs and every overlay directive reference **slugs**. `atomic/index.md`
 * has the id `atomic/index` and the URL `/atomic`. The engine only knows slugs, so the adapter has to
 * hold the bijection — and it has to derive slugs the way Docusaurus does, or a `renamedFrom` points at
 * a URL that never existed and `onBrokenLinks: 'throw'` fails the build.
 *
 * The engine's own `createSlugify` knows one of the three conventions below. Reimplementing it here is
 * not a convenience, it is a correctness requirement.
 */

import type { Slug } from "docs-overlay";

export const DEFAULT_PAGE_EXTENSIONS: readonly string[] = [".md", ".mdx"];

/**
 * Docusaurus strips a leading number from **every** path segment, directories included, so `040_filters.md`
 * under `tutorial/` is the doc `tutorial/filters` at the URL `/tutorial/filters`. Both patterns are copied
 * from the plugin rather than approximated, including the second one's job of *refusing* to strip: without
 * it, `7.0-notes.md` and `2021-11-release.md` would lose the part that identifies them, because a version
 * and a date both look exactly like a number followed by a separator.
 *
 * Modelling this is a correctness requirement, not polish. A sidebar names doc ids, and `pruneMissing()`
 * removes a reference whose doc it cannot find: an id computed without stripping matches nothing, so an
 * authored reference to a number-prefixed page would be silently pruned out of the navigation.
 */
const IGNORED_PREFIX = /^\d+[-_.]\d+/;
const NUMBER_PREFIX = /^(\d+)\s*[-_.]+\s*([^-_.\s].*)$/;

/** Options shared by the two identifier functions, mirroring the docs plugin's own. */
export interface IdentifierOptions {
  readonly pageExtensions?: readonly string[] | undefined;
  /** Docusaurus's `numberPrefixParser`, as a switch: false is its `DisabledNumberPrefixParser`. */
  readonly parseNumberPrefixes?: boolean | undefined;
}

function stripNumberPrefix(segment: string, parse: boolean): string {
  if (!parse || IGNORED_PREFIX.test(segment)) return segment;
  return NUMBER_PREFIX.exec(segment)?.[2] ?? segment;
}

/**
 * Doc id of a file, which is what a sidebar entry names: the path within the version, minus the extension,
 * with each segment's number prefix removed. Unlike a slug, `index` is **kept** — `atomic/index.md` is the
 * doc `atomic/index`.
 *
 * `declaredId` is the page's `id` frontmatter, which replaces the file name part and only that part: the
 * plugin joins it onto the directory prefix rather than using it whole.
 */
export function docIdOf(pathWithinVersion: string, options: IdentifierOptions | readonly string[] = {}, declaredId?: unknown): string {
  const { pageExtensions, parseNumberPrefixes } = asOptions(options);
  const segments = split(pathWithinVersion);
  const last = segments.pop();
  if (last === undefined) return "";

  const base =
    typeof declaredId === "string" && declaredId.trim() !== ""
      ? declaredId.trim()
      : stripNumberPrefix(stripExtension(last, pageExtensions), parseNumberPrefixes);
  return [...segments.map(segment => stripNumberPrefix(segment, parseNumberPrefixes)), base].join("/");
}

/**
 * Slug of a file, as Docusaurus derives it from the path.
 *
 * Three different file names take the URL of their folder, all case-insensitively: `index`, `README`,
 * and a file named after the folder that contains it. Missing any of them means the engine resolves one
 * slug while Docusaurus routes another, and every directive aimed at that page silently misses.
 */
export function docusaurusSlugify(options: IdentifierOptions | readonly string[] = {}): (pathWithinVersion: string) => Slug {
  const { pageExtensions, parseNumberPrefixes } = asOptions(options);

  return pathWithinVersion => {
    const segments = split(pathWithinVersion);
    const last = segments.pop();
    if (last === undefined) return [];

    const base = stripExtension(last, pageExtensions);
    const folder = segments.at(-1);
    const lower = base.toLowerCase();

    // The category-index test runs on the **raw** names, on both sides — `isCategoryIndex` compares
    // `path.parse(source).name` against the unstripped directory, so `020_guide/020_guide.md` matches while
    // `020_guide/guide.md` does not. Stripping before comparing would silently invent a category index.
    const isCategoryIndex = base === "" || lower === "index" || lower === "readme" || (folder !== undefined && lower === folder.toLowerCase());

    // Stripping happens on the way *out*, which is the asymmetry: the comparison above is raw, the emitted
    // URL is not. `020_guide/020_guide.md` is served at `/guide`, not `/020_guide`.
    const dirs = segments.map(segment => stripNumberPrefix(segment, parseNumberPrefixes));
    return isCategoryIndex ? dirs : [...dirs, stripNumberPrefix(base, parseNumberPrefixes)];
  };
}

function asOptions(options: IdentifierOptions | readonly string[]): { pageExtensions: readonly string[]; parseNumberPrefixes: boolean } {
  // An array is the old positional `pageExtensions`, kept working so a consumer's call site does not have to
  // move for a fix it did not ask for.
  if (Array.isArray(options)) return { pageExtensions: options, parseNumberPrefixes: true };
  const { pageExtensions, parseNumberPrefixes } = options as IdentifierOptions;
  return { pageExtensions: pageExtensions ?? DEFAULT_PAGE_EXTENSIONS, parseNumberPrefixes: parseNumberPrefixes ?? true };
}

/**
 * Reads the slug a page declares in its frontmatter, if any.
 *
 * A declared slug wins over the path, and it is the whole reason slugs must be assigned explicitly
 * rather than derived: a page carrying `slug: /faq` is routed at `/faq`, and an engine that resolved it
 * as `how-to/faq` would express every directive against a URL that does not exist.
 *
 * `slug` is absolute when it starts with `/`, otherwise relative to the file's own directory.
 */
export function declaredSlug(pathWithinVersion: string, frontMatterSlug: unknown, options: IdentifierOptions | readonly string[] = {}): Slug | undefined {
  if (typeof frontMatterSlug !== "string" || frontMatterSlug.trim() === "") return undefined;
  const value = frontMatterSlug.trim();

  if (value.startsWith("/")) return split(value);

  const parent = docusaurusSlugify(options)(pathWithinVersion).slice(0, -1);
  return [...parent, ...split(value)];
}

/**
 * URL a slug is served at, within one version.
 *
 * `versionPath` is `""` for the version served at the root — which is the shape Docusaurus produces via
 * `lastVersion`, and the reason old external links survive this migration untouched. Every URL in the
 * adapter goes through here, so a wrong assumption about `baseUrl` or trailing slashes is one fix in one
 * place rather than a hunt.
 */
export function docUrl(baseUrl: string, routeBasePath: string, versionPath: string, slug: Slug): string {
  const segments = [...split(baseUrl), ...split(routeBasePath), ...split(versionPath), ...slug].filter(segment => segment !== "");
  return `/${segments.join("/")}`;
}

function normalise(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function split(value: string): string[] {
  return normalise(value)
    .split("/")
    .filter(segment => segment !== "");
}

function stripExtension(fileName: string, pageExtensions: readonly string[]): string {
  const lower = fileName.toLowerCase();
  for (const extension of pageExtensions) {
    if (lower.endsWith(extension.toLowerCase())) return fileName.slice(0, fileName.length - extension.length);
  }
  return fileName;
}
