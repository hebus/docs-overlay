/**
 * Public surface of `docs-overlay-fumadocs`.
 *
 * This package re-projects an existing Fumadocs `StaticSource` through the overlay resolver in
 * `docs-overlay`. Fumadocs keeps compiling the MDX; the core only ever sees paths and opaque
 * metadata.
 *
 * `withOverlay()` lives in the `./schema` subpath so that `zod` stays an optional peer.
 */

export type { BuildMetaFilesOptions, MetaMergeContext, MetaMerger } from "./meta.js";
export { appendRest, buildMetaFiles, strictMeta } from "./meta.js";
export type { OverlayFumadocsOptions, OverlaySource } from "./overlay-source.js";
export { overlaySource } from "./overlay-source.js";
export type { OverlayDynamicOptions, OverlayDynamicSource } from "./dynamic.js";
export { overlayDynamicSource } from "./dynamic.js";
export type { PageTreeReader, ScopeReader } from "./diagnostics.js";
export { findOrphanPages, searchTagsOf, versionTagOf } from "./diagnostics.js";
export type { VersionTab } from "./tabs.js";
export { versionTabs, versionTree } from "./tabs.js";
export type { VersionInfo } from "./version-info.js";
export type { VersionSegmentFn } from "./paths.js";
export { defaultVersionSegment, slash, stripVersion, versionOfSlugs } from "./paths.js";
export type { StaticParamsOptions } from "./params.js";
export { slugsOfKind, staticParams } from "./params.js";
export type { NextRedirect } from "./redirects.js";
export { redirectParams, toNetlifyRedirects, toNextRedirects } from "./redirects.js";
export type { FumadocsMeta, ToFumadocsSourceOptions } from "./reproject.js";
export type { InheritedFrom, RouteResolution, VersionSwitch } from "./route.js";
export { resolveRoute, switchVersion } from "./route.js";
export { fromFumadocsSource, toFumadocsSource, toFumadocsSourceAll } from "./reproject.js";
