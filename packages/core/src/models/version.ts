import type { SemverParts } from "../version/semver.js";
import type { VersionId } from "./ids.js";

export interface Version {
  readonly id: VersionId;
  /** Rank in the global order. `0` is the oldest version — the one holding the complete tree. */
  readonly order: number;
  /** `undefined` for a channel (a folder whose name is not a version number). */
  readonly semver: SemverParts | undefined;
  /** The channel name when `semver` is `undefined`, otherwise `undefined`. */
  readonly channel: string | undefined;
  /**
   * Version this one overlays. Defaults to the immediately older version; an explicit override
   * makes maintenance branches expressible (`11.13.1` inheriting from `11.13.0` while `11.14.0`
   * also does). `undefined` for the root of a chain.
   */
  readonly inheritsFrom: VersionId | undefined;
  /**
   * Caller-supplied payload — display label, EOL status, anything. Opaque: the core never reads
   * it. Presentation concerns belong to the adapter.
   */
  readonly meta: unknown;
}

export interface VersionOverride {
  readonly inheritsFrom?: VersionId | undefined;
  readonly meta?: unknown;
}

export type VersionOverrides = Readonly<Record<VersionId, VersionOverride>>;
