import { createOverlay, type Diagnostic, type DiagnosticSink, type Overlay, type VersionId, type VersionOverrides } from "@docs-overlay/core";
import type { StaticSource } from "fumadocs-core/source";

import { appendRest, buildMetaFiles, type MetaMerger } from "./meta.js";
import { defaultVersionSegment, type VersionSegmentFn } from "./paths.js";
import { fromFumadocsSource, toFumadocsSourceAll, type FumadocsMeta } from "./reproject.js";
import { toVersionInfo, type VersionInfo } from "./version-info.js";

export interface OverlayFumadocsOptions<S extends StaticSource = StaticSource> {
  /**
   * The source `fumadocs-mdx` already built, i.e. `docs.toFumadocsSource()`.
   *
   * Pass a **function** to keep it live: the engine then re-reads it on `invalidate()`, which is what
   * lets a dev server see a file appear or disappear. A plain object is read once.
   */
  readonly source: S | (() => S);
  /** Must match the `baseUrl` given to `loader()`. Defaults to `/docs`. */
  readonly baseUrl?: string | undefined;
  /** Folder names that are not version numbers, typically `["next"]`. */
  readonly channels?: readonly string[] | undefined;
  /** Per-version `inheritsFrom` and opaque `meta` — how a maintenance branch is declared. */
  readonly versions?: VersionOverrides | undefined;
  readonly versionSegment?: VersionSegmentFn | undefined;
  /** Display labels, e.g. `{ next: "Next 🚧" }`. */
  readonly labels?: Readonly<Record<VersionId, string>> | undefined;
  /**
   * Serve one version at the base URL, so `/docs/guide/a` is the current documentation and
   * `/docs/11.13.0/guide/a` the old one. This is the Docusaurus URL shape, so migrating a site
   * breaks no existing link.
   *
   * That version is the newest release, or — when nothing has been released yet — simply the
   * newest version, so a project whose documentation precedes its first release still gets clean
   * URLs.
   */
  readonly latestAtRoot?: boolean | undefined;
  /** How an inherited `meta.json` is adapted to the browsing version. Defaults to {@link appendRest}. */
  readonly mergeMeta?: MetaMerger | undefined;
  /** Mark each version folder as a sidebar root. On by default; turning it off merges every version into one tree. */
  readonly rootPerVersion?: boolean | undefined;
  /** Order the versions in the tree. `"desc"` (newest first) by default. */
  readonly orderVersions?: boolean | "asc" | "desc" | undefined;
  readonly onDiagnostic?: DiagnosticSink | undefined;
}

export interface OverlaySource<S extends StaticSource = StaticSource> {
  /** Pass straight to `loader({ source })`. Holds every version. */
  readonly source: S;
  /** The engine, for anything the adapter does not wrap. */
  readonly overlay: Overlay<FumadocsMeta>;
  readonly versions: readonly VersionInfo[];
  /** The newest release. `undefined` until something has been released. */
  readonly latest: VersionInfo | undefined;
  /** The version served at the base URL, when `latestAtRoot` is on. */
  readonly root: VersionInfo | undefined;
  readonly baseUrl: string;
  readonly diagnostics: readonly Diagnostic[];
  /** Adds to {@link diagnostics}, so a loader plugin can report through the same channel. */
  report(diagnostic: Diagnostic): void;
  /**
   * Pass as `loader({ url })`. Required when `latestAtRoot` is on, since the version segment then
   * has to disappear from the newest release's URL while remaining in its slugs.
   */
  readonly url: (slugs: string[], locale?: string) => string;
  versionOf(id: VersionId): VersionInfo | undefined;
  versionOfSegment(segment: string): VersionInfo | undefined;
}

/**
 * Wires a Fumadocs source through the overlay engine.
 *
 * One `loader()` handles every version, with the version as the first slug segment. That keeps
 * `app/docs/[[...slug]]/page.tsx` unchanged, keeps relative links inside the version they were
 * written in — `resolveHref()` keys on the virtual path, and a single loader means a single storage —
 * and lets `generateParams()` cover all versions in one call.
 */
export function overlaySource<S extends StaticSource = StaticSource>(options: OverlayFumadocsOptions<S>): OverlaySource<S> {
  const baseUrl = normaliseBaseUrl(options.baseUrl ?? "/docs");
  const segmentOf = options.versionSegment ?? defaultVersionSegment;

  const diagnostics: Diagnostic[] = [];
  const onDiagnostic: DiagnosticSink = diagnostic => {
    diagnostics.push(diagnostic);
    options.onDiagnostic?.(diagnostic);
  };

  const read = typeof options.source === "function" ? options.source : () => options.source as S;
  const overlay = createOverlay<FumadocsMeta>({
    // A live content source rather than a snapshot: handing the engine an already-materialised array
    // would make `invalidate()` compare the content against itself and never notice a change.
    source: { id: "fumadocs", entries: () => fromFumadocsSource(read()) },
    channels: options.channels,
    versions: options.versions,
    onDiagnostic
  });

  const latestId = overlay.latest?.id;
  // `latest` is a release fact; which version sits at the root is a routing decision. They differ
  // before the first release, where the newest version is a channel and `latest` is undefined.
  const rootId = options.latestAtRoot === true ? (latestId ?? overlay.versions.at(-1)?.id) : undefined;

  const infos = overlay.versions.map(version => toVersionInfo(version, { baseUrl, segmentOf, labels: options.labels, latestId, rootId }));

  const byId = new Map(infos.map(info => [info.id, info]));
  const bySegment = new Map(infos.map(info => [info.segment, info]));
  const rootSegment = rootId === undefined ? undefined : byId.get(rootId)?.segment;

  // Metadata is emitted here rather than by the reprojection, because adapting an inherited
  // navigation list needs the whole picture: which pages this version adds, and which the authoring
  // version already knew about.
  const metaFiles = buildMetaFiles(overlay, {
    versions: infos,
    mergeMeta: options.mergeMeta ?? appendRest({ onDiagnostic }),
    rootPerVersion: options.rootPerVersion,
    orderVersions: options.orderVersions
  });

  const source = toFumadocsSourceAll(overlay, {
    versionSegment: segmentOf,
    includeMetas: false,
    extraFiles: metaFiles
  }) as S;

  return {
    source,
    overlay,
    versions: infos,
    latest: latestId === undefined ? undefined : byId.get(latestId),
    root: rootId === undefined ? undefined : byId.get(rootId),
    baseUrl,
    diagnostics,
    report: onDiagnostic,
    url: slugs => {
      // The slugs always carry the version; only the URL may drop it.
      const rest = rootSegment !== undefined && slugs[0] === rootSegment ? slugs.slice(1) : slugs;
      return rest.length === 0 ? baseUrl : `${baseUrl}/${rest.join("/")}`;
    },
    versionOf: id => byId.get(id),
    versionOfSegment: segment => bySegment.get(segment)
  };
}

function normaliseBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
