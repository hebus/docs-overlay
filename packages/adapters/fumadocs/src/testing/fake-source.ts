import type { MetaData, PageData, StaticSource, VirtualFile } from "fumadocs-core/source";

/**
 * Stand-ins for what `fumadocs-mdx` hands to `loader()`, so the adapter can be tested without Next,
 * MDX compilation or a filesystem.
 *
 * They mirror `toFumadocsSource()` as observed in `fumadocs-mdx`: `path` is relative to the
 * collection's `dir`, and `absolutePath` is `join(dir, path)` — which means it is *relative* and, on
 * Windows, backslash-separated.
 */
const CONTENT_DIR = "content/docs";

export function fumadocsPage(path: string, data: Partial<PageData> & Record<string, unknown> = {}): VirtualFile {
  return {
    type: "page",
    path,
    absolutePath: `${CONTENT_DIR}/${path}`,
    data: { title: path, ...data } as PageData
  };
}

/** A page whose slugs the source assigned itself, as a host using `slugsFromData` would produce. */
export function fumadocsPageWithSlugs(path: string, slugs: readonly string[], data: Partial<PageData> & Record<string, unknown> = {}): VirtualFile {
  return {
    type: "page",
    path,
    absolutePath: `${CONTENT_DIR}/${path}`,
    slugs: [...slugs],
    data: { title: path, ...data } as PageData
  };
}

/** Same as {@link fumadocsPage} but with a Windows-style `absolutePath`, to pin path normalisation. */
export function fumadocsPageWindows(path: string, data: Partial<PageData> & Record<string, unknown> = {}): VirtualFile {
  return {
    type: "page",
    path: path.replaceAll("/", "\\"),
    absolutePath: `${CONTENT_DIR}\\${path}`.replaceAll("/", "\\"),
    data: { title: path, ...data } as PageData
  };
}

export function fumadocsMeta(path: string, data: MetaData = {}): VirtualFile {
  return {
    type: "meta",
    path,
    absolutePath: `${CONTENT_DIR}/${path}`,
    data
  };
}

export function fakeStaticSource(...files: readonly VirtualFile[]): StaticSource {
  return { files: [...files] };
}
