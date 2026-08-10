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
 * Doc id of a file, which is what a sidebar entry names: the path within the version, minus the
 * extension. Unlike a slug, `index` is **kept** — `atomic/index.md` is the doc `atomic/index`.
 */
export function docIdOf(pathWithinVersion: string, pageExtensions: readonly string[] = DEFAULT_PAGE_EXTENSIONS): string {
  return stripExtension(normalise(pathWithinVersion), pageExtensions);
}

/**
 * Slug of a file, as Docusaurus derives it from the path.
 *
 * Three different file names take the URL of their folder, all case-insensitively: `index`, `README`,
 * and a file named after the folder that contains it. Missing any of them means the engine resolves one
 * slug while Docusaurus routes another, and every directive aimed at that page silently misses.
 */
export function docusaurusSlugify(pageExtensions: readonly string[] = DEFAULT_PAGE_EXTENSIONS): (pathWithinVersion: string) => Slug {
  return pathWithinVersion => {
    const segments = normalise(pathWithinVersion)
      .split("/")
      .filter(segment => segment !== "");
    const last = segments.pop();
    if (last === undefined) return [];

    const base = stripExtension(last, pageExtensions);
    const folder = segments.at(-1);
    const lower = base.toLowerCase();
    if (base === "" || lower === "index" || lower === "readme" || (folder !== undefined && lower === folder.toLowerCase())) {
      return segments;
    }
    return [...segments, base];
  };
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
export function declaredSlug(
  pathWithinVersion: string,
  frontMatterSlug: unknown,
  pageExtensions: readonly string[] = DEFAULT_PAGE_EXTENSIONS
): Slug | undefined {
  if (typeof frontMatterSlug !== "string" || frontMatterSlug.trim() === "") return undefined;
  const value = frontMatterSlug.trim();

  if (value.startsWith("/")) return split(value);

  const parent = docusaurusSlugify(pageExtensions)(pathWithinVersion).slice(0, -1);
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
