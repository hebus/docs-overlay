import type { DiagnosticSink, Overlay, ResolvedPage, VersionId } from "docs-overlay";
import type { MetaData, VirtualFile } from "fumadocs-core/source";

import { reSegment } from "./paths.js";
import type { FumadocsMeta } from "./reproject.js";
import type { VersionInfo } from "./version-info.js";

/**
 * Fumadocs' rest sentinels. Any of them means the author already told the page tree what to do with
 * files they did not list, so the merger must keep its hands off.
 *
 * `...` appends the remainder, `z...a` appends it reversed, `...folder` expands a folder, and a
 * leading `!` excludes.
 */
const REST = /^(\.\.\.|[a-z]\.\.\.[a-z]|\.\.\..+)$/i;

export interface MetaMergeContext {
  readonly version: VersionId;
  readonly dir: string;
  readonly inherited: boolean;
  /** Names this version serves in `dir` — file base names and immediate sub-folder names. */
  readonly names: readonly string[];
  /** The same, as of the version that actually authored the metadata file. */
  readonly authoredNames: readonly string[];
}

export type MetaMerger = (meta: MetaData, context: MetaMergeContext) => MetaData;

/**
 * The default, and the reason it exists.
 *
 * A `meta.json` with an exhaustive `pages: [...]` and no rest sentinel hides anything it does not
 * list. Inherit such a file into a newer version that added a page and the page is routed, indexed
 * by search, and **invisible in the sidebar** — silent, and the most likely failure in real use.
 * `atomic-angular/docs-site/content/docs/atomic-angular/meta.json` is exactly that file.
 *
 * So: when an inherited list cannot possibly have known about a name, append `...`. Names the
 * authoring version omitted on purpose stay omitted, because they were already omissions back then.
 */
export function appendRest(options: { readonly onDiagnostic?: DiagnosticSink | undefined } = {}): MetaMerger {
  return (meta, context) => {
    const pages = meta.pages;
    if (!context.inherited || pages === undefined || pages.some(entry => REST.test(entry.trim()))) return meta;

    const authored = new Set(context.authoredNames);
    const added = context.names.filter(name => !authored.has(name) && !pages.includes(name));
    if (added.length === 0) return meta;

    options.onDiagnostic?.({
      code: "meta-pages-completed",
      severity: "warning",
      message: `Version "${context.version}" adds ${added.map(name => `"${name}"`).join(", ")} in "${context.dir || "/"}" but inherits an exhaustive \`pages\` list; appending "..." so they stay visible. Add "..." to the list to control where they go.`,
      version: context.version
    });

    return { ...meta, pages: [...pages, "..."] };
  };
}

/** Changes nothing. Use it to find out what an exhaustive `pages` list is hiding. */
export function strictMeta(): MetaMerger {
  return meta => meta;
}

export interface BuildMetaFilesOptions {
  readonly versions: readonly VersionInfo[];
  readonly mergeMeta?: MetaMerger | undefined;
  /** Emit `<segment>/meta.json` with `root: true`, which is what scopes the sidebar to a version. */
  readonly rootPerVersion?: boolean | undefined;
  /** Emit the site-level `meta.json` listing versions newest first. */
  readonly orderVersions?: boolean | "asc" | "desc" | undefined;
}

/**
 * Every metadata file the emitted source needs: inherited ones (merged), a root marker per version,
 * and the site root that orders the versions.
 */
export function buildMetaFiles(overlay: Overlay<FumadocsMeta>, options: BuildMetaFilesOptions): VirtualFile[] {
  const merge = options.mergeMeta ?? appendRest();
  const files: VirtualFile[] = [];

  const namesByVersion = new Map<VersionId, Map<string, Set<string>>>();
  const namesOf = (version: VersionId): Map<string, Set<string>> => {
    const cached = namesByVersion.get(version);
    if (cached !== undefined) return cached;
    const computed = groupNames(overlay.getPages(version));
    namesByVersion.set(version, computed);
    return computed;
  };

  for (const info of options.versions) {
    const names = namesOf(info.id);

    for (const meta of overlay.getMetas(info.id)) {
      const merged = merge(meta.meta as MetaData, {
        version: info.id,
        dir: meta.dir,
        inherited: meta.inherited,
        names: [...(names.get(meta.dir) ?? [])],
        authoredNames: [...(namesOf(meta.source.definedIn).get(meta.dir) ?? [])]
      });

      files.push({
        type: "meta",
        path: reSegment(meta.source.path, info.segment),
        data: meta.dir === "" ? withRoot(merged, info, options.rootPerVersion !== false) : merged,
        ...(meta.origin === undefined ? {} : { absolutePath: meta.origin })
      });
    }

    // No `meta.json` at the version root? Synthesise one, otherwise nothing marks the version as a
    // sidebar root and every version's pages land in one flat tree.
    if (options.rootPerVersion !== false && overlay.getMeta(info.id, "") === undefined) {
      files.push({ type: "meta", path: `${info.segment}/meta.json`, data: { root: true, title: info.label } });
    }
  }

  const ordering = options.orderVersions ?? "desc";
  if (ordering !== false) {
    // Without this, the tree sorts by `localeCompare` and 11.10.0 lands before 11.9.0 — and
    // mint-internal really does have 11.6.1 through 11.14.0 side by side.
    const segments = options.versions.map(info => info.segment);
    files.push({ type: "meta", path: "meta.json", data: { pages: ordering === "asc" ? segments : [...segments].reverse() } });
  }

  return files;
}

function withRoot(meta: MetaData, info: VersionInfo, rootPerVersion: boolean): MetaData {
  if (!rootPerVersion) return meta;
  return { title: info.label, ...meta, root: true };
}

/** Names each directory of a version offers: page base names plus immediate sub-folder names. */
function groupNames(pages: readonly ResolvedPage<FumadocsMeta>[]): Map<string, Set<string>> {
  const byDir = new Map<string, Set<string>>();
  const put = (dir: string, name: string): void => {
    const existing = byDir.get(dir);
    if (existing === undefined) byDir.set(dir, new Set([name]));
    else existing.add(name);
  };

  for (const page of pages) {
    const within = stripSegment(page.source.path);
    const slash = within.lastIndexOf("/");
    const dir = slash === -1 ? "" : within.slice(0, slash);
    const file = slash === -1 ? within : within.slice(slash + 1);

    put(dir, file.replace(/\.[^./]+$/, ""));

    // Every ancestor sees the next segment down as a folder name it may list.
    let current = dir;
    while (current !== "") {
      const cut = current.lastIndexOf("/");
      const parent = cut === -1 ? "" : current.slice(0, cut);
      put(parent, cut === -1 ? current : current.slice(cut + 1));
      current = parent;
    }
  }

  return byDir;
}

function stripSegment(path: string): string {
  const slash = path.indexOf("/");
  return slash === -1 ? "" : path.slice(slash + 1);
}
