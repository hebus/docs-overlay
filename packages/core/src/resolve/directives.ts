import type { SlugKey } from "../models/ids.js";
import type { OverlayDirectives } from "../models/page.js";
import type { ContentEntry } from "../source/content-source.js";

export type ReadDirectivesFn<M> = (entry: ContentEntry<M>) => OverlayDirectives | undefined;

export const NO_DIRECTIVES: OverlayDirectives = Object.freeze({});

/**
 * Default extractor: the `overlay` key of the entry's metadata.
 *
 * Injected rather than hard-coded so that an adapter for a framework with a different frontmatter
 * convention never has to change the core.
 *
 * > Fumadocs' `pageSchema` is a zod object in `strip` mode, so `overlay:` is dropped from
 * > frontmatter unless the consumer widens the schema. That failure is silent, which is why
 * > `@docs-overlay/fumadocs/schema` exports `withOverlay()`.
 */
export function defaultReadDirectives<M>(entry: ContentEntry<M>): OverlayDirectives | undefined {
  const meta: unknown = entry.meta;
  if (typeof meta !== "object" || meta === null) return undefined;
  return normaliseDirectives((meta as { overlay?: unknown }).overlay);
}

/**
 * Accepts what an author plausibly writes — a bare string where a list is expected, a slug with
 * stray slashes — and drops anything unusable. Returns `undefined` when nothing is declared, so
 * callers can share {@link NO_DIRECTIVES}.
 */
export function normaliseDirectives(value: unknown): OverlayDirectives | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;

  const deleted = raw["deleted"] === true;
  const recursive = raw["recursive"] === true;
  const renamedFrom = toSlugKeys(raw["renamedFrom"]);
  const aliases = toSlugKeys(raw["aliases"]);
  const replacedBy = toSlugKey(raw["replacedBy"]);

  if (!deleted && !recursive && renamedFrom === undefined && aliases === undefined && replacedBy === undefined) {
    return undefined;
  }

  return {
    ...(deleted ? { deleted } : {}),
    ...(recursive ? { recursive } : {}),
    ...(renamedFrom === undefined ? {} : { renamedFrom }),
    ...(aliases === undefined ? {} : { aliases }),
    ...(replacedBy === undefined ? {} : { replacedBy })
  };
}

function toSlugKeys(value: unknown): readonly SlugKey[] | undefined {
  const candidates = typeof value === "string" ? [value] : Array.isArray(value) ? value : undefined;
  if (candidates === undefined) return undefined;

  const keys = candidates.map(toSlugKey).filter((key): key is SlugKey => key !== undefined);
  return keys.length === 0 ? undefined : keys;
}

function toSlugKey(value: unknown): SlugKey | undefined {
  if (typeof value !== "string") return undefined;
  // Authors write `/guide/old-api` or `guide/old-api/` interchangeably; both mean the same slug.
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? undefined : trimmed;
}
