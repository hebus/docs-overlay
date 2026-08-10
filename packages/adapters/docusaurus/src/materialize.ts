/**
 * Planning the tree Docusaurus insists on reading from disk.
 *
 * Docusaurus lets you configure exactly one source directory — the current version's. `versions.json`,
 * `versioned_docs/version-X/` and `versioned_sidebars/` live at fixed paths, no option supplies a source
 * folder per version, and `readVersionsMetadata()` runs inside the content plugin's factory, before any
 * hook of any plugin. There is therefore no point at which an overlay could resolve inheritance on the
 * fly. The only window is **before the build**, and the only thing that fits through it is a real tree.
 *
 * So this adapter materialises. It performs no I/O itself: it returns a description of files to copy and
 * files to write, and the caller does the writing. That keeps it testable with the same
 * filesystem-free factories as the rest of the repo, and it mirrors the Fumadocs adapter, which also
 * touches no disk — there because the framework does the reading, here because the CLI does the writing.
 */

import type { Diagnostic, DiagnosticSink, Overlay, ResolvedPage, Slug, SlugKey, Version, VersionId } from "docs-overlay";
import { slugKey, splitVersionSegment } from "docs-overlay";

import type { DocusaurusSidebars, SidebarMerger } from "./sidebars.js";
import { pruneMissing, referencesOf } from "./sidebars.js";
import { docIdOf, DEFAULT_PAGE_EXTENSIONS, docUrl } from "./slugs.js";
import type { StubTemplates } from "./templates.js";
import { defaultTemplates } from "./templates.js";

/** What the caller attaches to each entry. Opaque to the engine, read only here. */
export interface DocusaurusMeta {
  /** Parsed frontmatter of a page. */
  readonly frontMatter?: Readonly<Record<string, unknown>> | undefined;
  /** The sidebar set, when the entry is a version's `sidebars.json`. */
  readonly sidebars?: DocusaurusSidebars | undefined;
}

export type MaterializedFile =
  /** Copy the bytes of `from` to `path`. Copying rather than re-emitting is what keeps CRLF, encoding and every MDX import intact. */
  | { readonly kind: "copy"; readonly path: string; readonly from: string }
  /** Write `contents` at `path`. Only ever a generated file: a sidebar, the version list, a stub. */
  | { readonly kind: "write"; readonly path: string; readonly contents: string };

export interface DocusaurusVersion {
  readonly id: VersionId;
  /** What Docusaurus calls it: the id for a release, `"current"` for the channel. */
  readonly name: string;
  /** URL segment. `""` for the version served at the root, which is the shape `lastVersion` produces. */
  readonly path: string;
  readonly label: string;
  readonly isLatest: boolean;
  readonly isCurrent: boolean;
  /** Where its pages go, relative to the site directory. */
  readonly docsDir: string;
  /** Where its sidebar goes, relative to the site directory. */
  readonly sidebarsPath: string;
}

export interface DocsPluginOptions {
  readonly path: string;
  readonly sidebarPath: string;
  readonly includeCurrentVersion: boolean;
  readonly lastVersion?: string | undefined;
  readonly versions: Readonly<Record<string, { readonly label?: string; readonly path?: string }>>;
}

export interface Materialization {
  readonly files: readonly MaterializedFile[];
  /** Roots the writer owns and may prune. Nothing outside them is ever touched. */
  readonly directories: readonly string[];
  readonly versions: readonly DocusaurusVersion[];
  /** The block to spread into the `docs` preset options. Derived, so it cannot drift from the tree. */
  readonly docsOptions: DocsPluginOptions;
  /** Slug-to-slug rules, as URLs, for a caller that also wants real HTTP redirects. */
  readonly redirects: readonly { readonly from: string; readonly to: string; readonly permanent: boolean }[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface MaterializeOptions {
  /** The site's `baseUrl`. Only used to build URLs that appear inside generated stubs. */
  readonly baseUrl?: string | undefined;
  /** Must match the `docs` plugin's `routeBasePath`. */
  readonly routeBasePath?: string | undefined;
  /** Root of everything this adapter owns and may delete. */
  readonly outDir?: string | undefined;
  /** Set for a non-default docs plugin instance: Docusaurus then prefixes its fixed paths with `<id>_`. */
  readonly pluginId?: string | undefined;
  /** Display labels, e.g. `{ next: "Next 🚧" }`. */
  readonly labels?: Readonly<Record<VersionId, string>> | undefined;
  /** Name of the per-version navigation file inside the content tree. */
  readonly sidebarsFile?: string | undefined;
  /** How an inherited sidebar adapts to the version browsing it. Prunes by default. */
  readonly mergeSidebars?: SidebarMerger | undefined;
  readonly templates?: Partial<StubTemplates> | undefined;
  readonly pageExtensions?: readonly string[] | undefined;
  readonly onDiagnostic?: DiagnosticSink | undefined;
}

export function materialize(overlay: Overlay<DocusaurusMeta>, options: MaterializeOptions = {}): Materialization {
  const diagnostics: Diagnostic[] = [];
  const report = (diagnostic: Diagnostic): void => {
    diagnostics.push(diagnostic);
    options.onDiagnostic?.(diagnostic);
  };

  const baseUrl = options.baseUrl ?? "/";
  const routeBasePath = options.routeBasePath ?? "docs";
  const outDir = options.outDir ?? ".docs-overlay";
  const prefix = options.pluginId === undefined || options.pluginId === "" ? "" : `${options.pluginId}_`;
  const sidebarsFile = options.sidebarsFile ?? "sidebars.json";
  const merge = options.mergeSidebars ?? pruneMissing();
  const templates: StubTemplates = { ...defaultTemplates, ...options.templates };
  const pageExtensions = options.pageExtensions ?? DEFAULT_PAGE_EXTENSIONS;

  const channels = overlay.versions.filter(version => version.channel !== undefined);
  const releases = overlay.versions.filter(version => version.channel === undefined);
  const latest = overlay.latest;

  // Docusaurus has exactly one "current" version, so more than one channel has no representation. Saying
  // so beats picking one and letting the other vanish from the site without a word.
  if (channels.length > 1) {
    report({
      code: "ambiguous-version-order",
      severity: "error",
      message: `Docusaurus serves a single current version, but ${channels.length} channels are declared: ${channels.map(channel => channel.id).join(", ")}.`
    });
  }
  const current = channels.at(-1);

  const versions: DocusaurusVersion[] = [];
  for (const version of overlay.versions) {
    const isCurrent = current !== undefined && version.id === current.id;
    const isLatest = latest !== undefined && version.id === latest.id;
    versions.push({
      id: version.id,
      name: isCurrent ? "current" : version.id,
      // The released `lastVersion` sits at the base URL with no segment of its own; everything else,
      // channel included, is addressed by its folder name. That is what makes the URLs identical to a
      // plain Docusaurus site, so nothing linked from outside breaks.
      path: isLatest ? "" : version.id,
      label: options.labels?.[version.id] ?? labelOf(version),
      isLatest,
      isCurrent,
      docsDir: isCurrent ? `${outDir}/current` : `${prefix}versioned_docs/version-${version.id}`,
      sidebarsPath: isCurrent ? `${outDir}/sidebars/current.json` : `${prefix}versioned_sidebars/version-${version.id}-sidebars.json`
    });
  }

  const files: MaterializedFile[] = [];
  const redirects: { from: string; to: string; permanent: boolean }[] = [];

  for (const version of versions) {
    const pages = overlay.getPages(version.id);

    // Destination is the path rewritten into the browsing version's space. Writing a page at its own
    // `source.path` would drop an inherited file into the folder of the version that defined it — the
    // literal form of the pitfall the adapter guide warns about.
    const docIds = new Set<string>();
    const dirNames = new Set<string>();
    const emitted = new Set<string>();

    for (const page of pages) {
      const rest = splitVersionSegment(page.source.path).rest;
      if (rest === "" || page.origin === undefined) {
        report({
          code: "orphan-page",
          severity: "warning",
          message: `${version.id}: "${page.source.path}" has no usable origin, so its bytes cannot be copied.`,
          version: version.id,
          path: page.source.path
        });
        continue;
      }
      files.push({ kind: "copy", path: `${version.docsDir}/${rest}`, from: page.origin });
      emitted.add(rest);
      docIds.add(docIdOf(rest, pageExtensions));
      for (const dir of ancestorsOf(rest)) dirNames.add(dir);
    }

    // Every routable slug, not only the pages: aliases, old slugs and removed pages each want a
    // different answer, and on a static host a slug nobody generated is a 404 rather than a redirect.
    for (const entry of overlay.getEntries(version.id)) {
      if (entry.kind === "page") continue;
      const stub = stubFor(overlay, version, versions, entry.slug, entry.kind, templates, baseUrl, routeBasePath, report);
      if (stub === undefined) continue;

      const path = stubPath(entry.slug, emitted, dirNames);
      files.push({ kind: "write", path: `${version.docsDir}/${path}`, contents: stub.contents });
      // Deliberately not added to `docIds`. A stub is a route, not a page: counting it would let an
      // inherited sidebar keep pointing at a page this version removed, and would hide a rename from the
      // merger — the old doc id would look present, so the reference would never be rewritten. It stays
      // out of `dirNames` for the same reason.
      emitted.add(path);
      if (stub.redirect !== undefined) redirects.push(stub.redirect);
    }

    // Navigation. The version's own `sidebars.json` if it has one, otherwise the inherited file, adapted.
    const meta = overlay.getMeta(version.id, "");
    const sidebars = meta?.meta.sidebars;
    if (sidebars === undefined) {
      report({
        code: "meta-pages-completed",
        severity: "error",
        message: `${version.id}: no ${sidebarsFile} in this version or anything it inherits from, so it has no navigation.`,
        version: version.id
      });
    } else {
      const authored = referencesOf(sidebars);
      const merged = merge(sidebars, {
        version: version.id,
        inherited: meta?.inherited ?? false,
        docIds,
        dirNames,
        authoredDocIds: new Set(authored.docIds),
        renamedTo: docId => renamedTo(overlay, version.id, docId, pageExtensions),
        onDiagnostic: report
      });
      files.push({ kind: "write", path: version.sidebarsPath, contents: `${JSON.stringify(merged, undefined, 2)}\n` });
    }
  }

  // Newest first, channels excluded — the order and the contents Docusaurus expects.
  const versionsJson = releases.map(version => version.id).reverse();
  files.push({ kind: "write", path: `${prefix}versions.json`, contents: `${JSON.stringify(versionsJson, undefined, 2)}\n` });

  const directories = [outDir, `${prefix}versioned_docs`, `${prefix}versioned_sidebars`];

  return {
    files,
    directories,
    versions,
    docsOptions: docsOptionsOf(versions, current, latest, outDir),
    redirects,
    diagnostics: [...diagnostics, ...overlay.diagnostics()]
  };
}

function docsOptionsOf(versions: readonly DocusaurusVersion[], current: Version | undefined, latest: Version | undefined, outDir: string): DocsPluginOptions {
  const versionConfig: Record<string, { label?: string; path?: string }> = {};
  for (const version of versions) {
    if (version.isCurrent) {
      versionConfig["current"] = { label: version.label, path: version.path };
      continue;
    }
    if (version.isLatest) {
      // `lastVersion` already puts it at the root; a `path` here would add a segment back.
      versionConfig[version.id] = { label: version.label };
      continue;
    }
    versionConfig[version.id] = { label: version.label, path: version.path };
  }

  return {
    // Docusaurus only lets the current version's source move, so that is where the folded channel goes.
    // Everything else lands at the paths it hardcodes.
    path: `${outDir}/current`,
    sidebarPath: `./${outDir}/sidebars/current.json`,
    includeCurrentVersion: current !== undefined,
    ...(latest === undefined ? {} : { lastVersion: latest.id }),
    versions: versionConfig
  };
}

interface Stub {
  readonly contents: string;
  readonly redirect?: { readonly from: string; readonly to: string; readonly permanent: boolean } | undefined;
}

function stubFor(
  overlay: Overlay<DocusaurusMeta>,
  version: DocusaurusVersion,
  versions: readonly DocusaurusVersion[],
  slug: Slug,
  kind: "alias" | "redirect" | "deleted",
  templates: StubTemplates,
  baseUrl: string,
  routeBasePath: string,
  report: DiagnosticSink
): Stub | undefined {
  const resolution = overlay.resolve(version.id, slug);
  const url = (target: Slug, at: DocusaurusVersion = version): string => docUrl(baseUrl, routeBasePath, at.path, target);
  const servable = (target: Slug): boolean => {
    const kind = overlay.resolve(version.id, target).kind;
    return kind === "own" || kind === "inherited" || kind === "alias";
  };

  if (kind === "redirect" && resolution.kind === "redirect") {
    return {
      contents: templates.redirect({ slug, to: resolution.to, url: url(resolution.to), permanent: resolution.permanent }),
      redirect: { from: url(slug), to: url(resolution.to), permanent: resolution.permanent }
    };
  }

  if (kind === "alias" && resolution.kind === "alias") {
    return { contents: templates.alias({ slug, canonical: resolution.canonical, url: url(resolution.canonical) }) };
  }

  if (kind === "deleted" && resolution.kind === "deleted") {
    const lastAvailable = resolution.lastAvailable?.version;
    const at = versions.find(candidate => candidate.id === lastAvailable);

    // `replacedBy` names a **slug**, and a Docusaurus author naturally writes a **doc id** — the two
    // differ for every `index` page, whose doc id is `index` and whose slug is empty. Left unchecked this
    // emits a link to a route that does not exist, which `onBrokenLinks: 'throw'` would eventually catch
    // as an unexplained build failure in a generated file nobody wrote.
    let replacedBy = resolution.replacedBy;
    if (replacedBy !== undefined && !servable(replacedBy)) {
      report({
        code: "redirect-target-missing",
        severity: "error",
        message:
          `${version.id}: "${slugKey(slug)}" is replaced by "${slugKey(replacedBy)}", which this version does not serve. ` +
          `Note that replacedBy takes a slug, not a doc id: the slug of an index page is its folder, not "…/index".`,
        version: version.id,
        slug
      });
      replacedBy = undefined;
    }

    return {
      contents: templates.deleted({
        slug,
        deletedIn: resolution.deletedIn,
        lastAvailable,
        lastAvailableUrl: at === undefined ? undefined : url(slug, at),
        replacedBy,
        replacedByUrl: replacedBy === undefined ? undefined : url(replacedBy)
      })
    };
  }

  return undefined;
}

/**
 * Where a stub's file goes.
 *
 * `<slug>.mdx`, unless the slug is also a directory holding pages — then `<slug>/index.mdx`, because a
 * file and a directory cannot share a name.
 */
function stubPath(slug: Slug, emitted: ReadonlySet<string>, dirNames: ReadonlySet<string>): string {
  const key = slugKey(slug);
  if (key === "") return "index.mdx";
  if (dirNames.has(key)) return `${key}/index.mdx`;
  return emitted.has(`${key}.mdx`) || emitted.has(`${key}.md`) ? `${key}/index.mdx` : `${key}.mdx`;
}

/** Doc id the overlay redirects `docId` to, when it redirects it at all. */
function renamedTo(overlay: Overlay<DocusaurusMeta>, version: VersionId, docId: string, pageExtensions: readonly string[]): string | undefined {
  const asSlug: SlugKey = docId.replace(/\/index$/, "");
  const resolution = overlay.resolve(version, asSlug);
  if (resolution.kind !== "redirect") return undefined;
  const target = overlay.resolve(version, resolution.to);
  if (target.kind !== "own" && target.kind !== "inherited") return undefined;
  return docIdOf(splitVersionSegment(target.page.source.path).rest, pageExtensions);
}

function labelOf(version: Version): string {
  return version.channel ?? version.id;
}

function ancestorsOf(pathWithinVersion: string): readonly string[] {
  const segments = pathWithinVersion.split("/").slice(0, -1);
  const out: string[] = [];
  for (let index = 1; index <= segments.length; index += 1) out.push(segments.slice(0, index).join("/"));
  return out;
}

export type { ResolvedPage };
