/**
 * Public surface of `docs-overlay`.
 *
 * Everything a consumer may rely on is re-exported from this file; nothing else in
 * `src/` is part of the contract. The package is deliberately dependency-free and
 * free of Node built-ins — see `architecture.test.ts`, which fails the build if that
 * ever stops being true.
 */

export type { InvalidationResult, Overlay, OverlayOptions, VersionEntry } from "./create-overlay.js";
export { createOverlay } from "./create-overlay.js";
export type { Dependent, EntryDependent, EntryDependentKind, MetaDependent } from "./graph/dependency-graph.js";
export type { CandidateInput, CandidateThresholds, CandidateWeights, Ineligible, Ranking, RenameCandidate, Verdict } from "./migrate/rename-candidates.js";
export { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, rankCandidates, replacementSuggestions } from "./migrate/rename-candidates.js";
export type {
  Snapshot,
  SnapshotDecision,
  SnapshotFile,
  SnapshotPlan,
  SnapshotPlanOptions,
  SnapshotQuestion,
  SnapshotStats,
  SnapshotStep
} from "./migrate/snapshot-plan.js";
export { decisionKey, planSnapshots } from "./migrate/snapshot-plan.js";
export type { Comparable } from "./migrate/similarity.js";
export { comparable, contentScore, pathScore, stemScore, titleScore } from "./migrate/similarity.js";
export type { Diagnostic, DiagnosticCode, DiagnosticSeverity, DiagnosticSink } from "./models/diagnostic.js";
export type { DocumentationSource } from "./models/documentation-source.js";
export type { Slug, SlugKey, SourcePath, VersionId } from "./models/ids.js";
export { parseSlugKey, slugKey, splitVersionSegment, toSlug, toSlugKey, withVersionSegment } from "./models/ids.js";
export type { OverlayDirectives, PageRef, ResolvedMeta, ResolvedPage } from "./models/page.js";
export type { LastAvailable, RedirectReason, RedirectRule, Resolution } from "./models/resolution.js";
export type { Version, VersionOverride, VersionOverrides } from "./models/version.js";
export type { ReadDirectivesFn } from "./resolve/directives.js";
export { defaultReadDirectives, normaliseDirectives } from "./resolve/directives.js";
export type { SlugifyFn } from "./resolve/slugify.js";
export { createSlugify, DEFAULT_PAGE_EXTENSIONS, dirOf } from "./resolve/slugify.js";
export { arrayContentSource } from "./source/array-source.js";
export type { ContentEntry, ContentEntryKind, ContentSource } from "./source/content-source.js";
export { chainOf, descendantsOf, foldOrder } from "./version/chain.js";
export type { OrderVersionsOptions } from "./version/order.js";
export { latestVersion, orderVersions } from "./version/order.js";
export type { SemverParts } from "./version/semver.js";
export { compareSemver, isStableSemver, parseSemver } from "./version/semver.js";
