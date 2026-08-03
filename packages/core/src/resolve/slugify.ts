import type { Slug } from "../models/ids.js";

export const DEFAULT_PAGE_EXTENSIONS: readonly string[] = [".md", ".mdx"];

export type SlugifyFn = (pathWithinVersion: string) => Slug;

/**
 * Turns `guide/api.mdx` into `["guide", "api"]` and `guide/index.mdx` into `["guide"]`, so the
 * landing page of a folder shares the folder's URL.
 *
 * Only extensions listed in `pageExtensions` are stripped: a file the caller declared as a page
 * under some other extension keeps its name, rather than being silently truncated at the last dot.
 */
export function createSlugify(pageExtensions: readonly string[] = DEFAULT_PAGE_EXTENSIONS): SlugifyFn {
  return pathWithinVersion => {
    const segments = pathWithinVersion.split("/").filter(segment => segment !== "");
    const last = segments.pop();
    if (last === undefined) return [];

    const base = stripExtension(last, pageExtensions);
    return base === "" || base === "index" ? segments : [...segments, base];
  };
}

/** Directory a file governs, relative to its version root. `""` for the version root itself. */
export function dirOf(pathWithinVersion: string): string {
  const index = pathWithinVersion.lastIndexOf("/");
  return index === -1 ? "" : pathWithinVersion.slice(0, index);
}

function stripExtension(fileName: string, pageExtensions: readonly string[]): string {
  const lower = fileName.toLowerCase();
  for (const extension of pageExtensions) {
    if (lower.endsWith(extension.toLowerCase())) return fileName.slice(0, fileName.length - extension.length);
  }
  return fileName;
}
