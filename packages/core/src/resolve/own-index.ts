import type { DiagnosticSink } from "../models/diagnostic.js";
import { slugKey, splitVersionSegment, type Slug, type SlugKey, type SourcePath, type VersionId } from "../models/ids.js";
import type { OverlayDirectives } from "../models/page.js";
import type { ContentEntry } from "../source/content-source.js";
import { NO_DIRECTIVES, type ReadDirectivesFn } from "./directives.js";
import { dirOf, type SlugifyFn } from "./slugify.js";

/** A page file that physically lives in this version's folder. */
export interface OwnPage<M> {
  readonly version: VersionId;
  /** Full path, version segment included. */
  readonly path: SourcePath;
  readonly slug: Slug;
  readonly meta: M;
  readonly origin: string | undefined;
  readonly directives: OverlayDirectives;
}

/** A navigation metadata file that physically lives in this version's folder. */
export interface OwnMeta<M> {
  readonly version: VersionId;
  readonly path: SourcePath;
  /** Directory it governs, relative to the version root. `""` for the version root. */
  readonly dir: string;
  readonly meta: M;
  readonly origin: string | undefined;
}

export interface OwnIndex<M> {
  readonly pages: ReadonlyMap<SlugKey, OwnPage<M>>;
  readonly metas: ReadonlyMap<string, OwnMeta<M>>;
}

export interface BuildOwnIndexesOptions<M> {
  readonly slugify: SlugifyFn;
  readonly readDirectives: ReadDirectivesFn<M>;
  readonly onDiagnostic?: DiagnosticSink | undefined;
}

/**
 * Groups entries by the version folder they live in, without interpreting inheritance.
 *
 * Every discovered folder gets an index, including ones the version ordering will later reject:
 * the fold simply never asks for those, and building them costs nothing.
 */
export function buildOwnIndexes<M>(entries: Iterable<ContentEntry<M>>, options: BuildOwnIndexesOptions<M>): ReadonlyMap<VersionId, OwnIndex<M>> {
  const pages = new Map<VersionId, Map<SlugKey, OwnPage<M>>>();
  const metas = new Map<VersionId, Map<string, OwnMeta<M>>>();

  const bucket = <T>(map: Map<VersionId, Map<string, T>>, version: VersionId): Map<string, T> => {
    const existing = map.get(version);
    if (existing !== undefined) return existing;
    const created = new Map<string, T>();
    map.set(version, created);
    return created;
  };

  for (const entry of entries) {
    const { version, rest } = splitVersionSegment(entry.path);
    if (version === "" || rest === "") continue;

    if (entry.kind === "meta") {
      const dir = dirOf(rest);
      bucket(metas, version).set(dir, {
        version,
        path: entry.path,
        dir,
        meta: entry.meta,
        origin: entry.origin
      });
      continue;
    }

    const slug = entry.slug ?? options.slugify(rest);
    const key = slugKey(slug);
    const versionPages = bucket(pages, version);
    const clash = versionPages.get(key);

    if (clash !== undefined) {
      options.onDiagnostic?.({
        code: "duplicate-slug",
        severity: "error",
        message: `"${entry.path}" and "${clash.path}" both resolve to the slug "${key}" in version "${version}"; keeping "${clash.path}".`,
        version,
        path: entry.path,
        slug
      });
      continue;
    }

    versionPages.set(key, {
      version,
      path: entry.path,
      slug,
      meta: entry.meta,
      origin: entry.origin,
      directives: options.readDirectives(entry) ?? NO_DIRECTIVES
    });
  }

  const versions = new Set<VersionId>([...pages.keys(), ...metas.keys()]);
  const result = new Map<VersionId, OwnIndex<M>>();
  for (const version of versions) {
    result.set(version, {
      pages: pages.get(version) ?? new Map(),
      metas: metas.get(version) ?? new Map()
    });
  }

  return result;
}
