import type { Version, VersionId } from "@docs-overlay/core";

import type { VersionSegmentFn } from "./paths.js";

/** A version, plus the presentation and routing facts an adapter — not the core — is responsible for. */
export interface VersionInfo {
  readonly id: VersionId;
  /** URL segment identifying the version. Defaults to the folder name. */
  readonly segment: string;
  /** Display label. Defaults to the id; override through `labels` or `versions[id].meta.label`. */
  readonly label: string;
  /** The highest release — the one served at the base URL when `latestAtRoot` is on. */
  readonly isLatest: boolean;
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
  readonly latestAtRoot: boolean;
}

export function toVersionInfo(version: Version, context: VersionInfoContext): VersionInfo {
  const segment = context.segmentOf(version);
  const isLatest = version.id === context.latestId;

  return {
    id: version.id,
    segment,
    label: context.labels?.[version.id] ?? labelFromMeta(version.meta) ?? version.id,
    isLatest,
    isChannel: version.channel !== undefined,
    url: context.latestAtRoot && isLatest ? context.baseUrl : `${context.baseUrl}/${segment}`
  };
}

/** `Version.meta` is opaque to the core; presentation is read here, where it belongs. */
function labelFromMeta(meta: unknown): string | undefined {
  if (typeof meta !== "object" || meta === null) return undefined;
  const label = (meta as { label?: unknown }).label;
  return typeof label === "string" ? label : undefined;
}
