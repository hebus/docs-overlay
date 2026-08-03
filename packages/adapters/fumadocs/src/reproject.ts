import type { ContentEntry, Overlay, Version, VersionId } from "@docs-overlay/core";
import type { MetaData, PageData, StaticSource, VirtualFile } from "fumadocs-core/source";

import { defaultVersionSegment, reSegment, slash, withSegment, type VersionSegmentFn } from "./paths.js";

/** Metadata the core carries around: whatever `fumadocs-mdx` put on a page or a `meta.json`. */
export type FumadocsMeta = PageData | MetaData;

/**
 * Turns the `StaticSource` that `fumadocs-mdx` already produced into entries for the core.
 *
 * `toFumadocsSource()` yields paths relative to the collection's `dir`, so with
 * `content/docs/11.14.0/guide/a.md` the first segment already *is* the version — nothing has to be
 * inferred. The core never sees the compiled MDX: `data` travels through as an opaque payload.
 */
export function fromFumadocsSource(source: StaticSource, options: { readonly baseDir?: string | undefined } = {}): ContentEntry<FumadocsMeta>[] {
  const prefix = options.baseDir === undefined || options.baseDir === "" ? "" : `${slash(options.baseDir).replace(/\/+$/, "")}/`;

  return source.files.map(file => toEntry(file, prefix));
}

function toEntry(file: VirtualFile, prefix: string): ContentEntry<FumadocsMeta> {
  const path = stripPrefix(slash(file.path), prefix);
  const slug = file.type === "page" ? explicitSlug(path, file.slugs) : undefined;

  return {
    path,
    kind: file.type === "page" ? "page" : "meta",
    meta: file.data,
    ...(slug === undefined ? {} : { slug }),
    // Kept as the handle back to the real file: "edit on GitHub", last-modified, watchers.
    ...(file.absolutePath === undefined ? {} : { origin: slash(file.absolutePath) })
  };
}

function stripPrefix(path: string, prefix: string): string {
  return prefix !== "" && path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/**
 * A source that already assigned slugs did so in the *whole* path's space, version segment included.
 * Strip it so the core stores the version-free slug it works with.
 */
function explicitSlug(path: string, slugs: readonly string[] | undefined): readonly string[] | undefined {
  if (slugs === undefined) return undefined;

  const version = path.slice(0, path.indexOf("/"));
  return slugs[0] === version ? slugs.slice(1) : slugs;
}

export interface ToFumadocsSourceOptions {
  /** Defaults to the version id. */
  readonly versionSegment?: VersionSegmentFn | undefined;
  /** Extra files to append — redirect pages, tombstone pages, synthesised metadata. */
  readonly extraFiles?: readonly VirtualFile[] | undefined;
  /** Set to `false` when the caller emits metadata itself, e.g. through `buildMetaFiles()`. */
  readonly includeMetas?: boolean | undefined;
}

/**
 * Re-emits one version of the overlay as a Fumadocs source.
 *
 * Three details matter, and breaking any of them breaks the site quietly:
 *
 * - `path` is rewritten into the browsing version's space. `resolveHref()` keys on the virtual path,
 *   so this is what keeps `./b.mdx` pointing inside the version a reader is on.
 * - `slugs` is set explicitly. Left to `slugsPlugin`, a host using `slugsFromData` would derive the
 *   same slug for every version and the build would die on `Duplicated slugs`.
 * - `data` is passed by reference, never cloned, so a page served by five versions still compiles to
 *   one chunk.
 *
 * `absolutePath` deliberately keeps pointing at the *defining* file, which is what "edit this page"
 * and last-modified want, even though `path` says otherwise.
 */
export function toFumadocsSource(overlay: Overlay<FumadocsMeta>, versionId: VersionId, options: ToFumadocsSourceOptions = {}): StaticSource {
  const version = overlay.getVersion(versionId);
  if (version === undefined) return { files: [...(options.extraFiles ?? [])] };

  const segment = (options.versionSegment ?? defaultVersionSegment)(version);
  const files: VirtualFile[] = [];

  for (const page of overlay.getPages(versionId)) {
    files.push({
      type: "page",
      path: reSegment(page.source.path, segment),
      slugs: withSegment(segment, page.slug),
      data: page.meta as PageData,
      ...(page.origin === undefined ? {} : { absolutePath: page.origin })
    });
  }

  if (options.includeMetas !== false) {
    for (const meta of overlay.getMetas(versionId)) {
      files.push({
        type: "meta",
        path: reSegment(meta.source.path, segment),
        data: meta.meta as MetaData,
        ...(meta.origin === undefined ? {} : { absolutePath: meta.origin })
      });
    }
  }

  files.push(...(options.extraFiles ?? []));
  return { files };
}

/** Every version of the overlay in one source, which is what a single `loader()` consumes. */
export function toFumadocsSourceAll(
  overlay: Overlay<FumadocsMeta>,
  options: ToFumadocsSourceOptions & { readonly versions?: readonly Version[] | undefined } = {}
): StaticSource {
  const versions = options.versions ?? overlay.versions;
  const files: VirtualFile[] = [];

  for (const version of versions) {
    files.push(...toFumadocsSource(overlay, version.id, { versionSegment: options.versionSegment, includeMetas: options.includeMetas }).files);
  }

  files.push(...(options.extraFiles ?? []));
  return { files };
}
