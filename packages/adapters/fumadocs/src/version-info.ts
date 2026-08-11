import type { Version, VersionId } from "docs-overlay";

import { joinUrl, type VersionSegmentFn } from "./paths.js";

/** A version, plus the presentation and routing facts an adapter — not the core — is responsible for. */
export interface VersionInfo {
  readonly id: VersionId;
  /** URL segment identifying the version. Defaults to the folder name. */
  readonly segment: string;
  /** Display label. Defaults to the id; override through `labels` or `versions[id].meta.label`. */
  readonly label: string;
  /** The highest release. `false` for every version when nothing has been released yet. */
  readonly isLatest: boolean;
  /** Served at the base URL, with no segment in its URLs. At most one version is. */
  readonly isRoot: boolean;
  /** An unreleased channel such as `next`. */
  readonly isChannel: boolean;
  /** Landing page of the version. */
  readonly url: string;
}

export interface VersionInfoContext {
  readonly baseUrl: string;
  readonly segmentOf: VersionSegmentFn;
  readonly labels: Readonly<Record<VersionId, string>> | undefined;
  readonly latestId: VersionId | undefined;
  /** Version to serve at the base URL, or `undefined` to give every version a segment. */
  readonly rootId: VersionId | undefined;
}

export function toVersionInfo(version: Version, context: VersionInfoContext): VersionInfo {
  const segment = context.segmentOf(version);
  const isRoot = version.id === context.rootId;

  return {
    id: version.id,
    segment,
    label: context.labels?.[version.id] ?? labelFromMeta(version.meta) ?? version.id,
    isLatest: version.id === context.latestId,
    isRoot,
    isChannel: version.channel !== undefined,
    // The root version has no segment, and `joinUrl` given none hands back the base URL — so the
    // absence of a segment is the whole rule, with no second place that knows what "root" means.
    url: joinUrl(context.baseUrl, isRoot ? "" : segment)
  };
}

/** `Version.meta` is opaque to the core; presentation is read here, where it belongs. */
function labelFromMeta(meta: unknown): string | undefined {
  if (typeof meta !== "object" || meta === null) return undefined;
  const label = (meta as { label?: unknown }).label;
  return typeof label === "string" ? label : undefined;
}
