import type { Slug } from "docs-overlay";

import type { OverlaySource } from "./overlay-source.js";

export interface StaticParamsOptions {
  /** Route parameter name. Matches the folder: `[[...slug]]` → `"slug"`. */
  readonly param?: string | undefined;
  /** Generate a page for every old slug so a rename survives a static host. On by default. */
  readonly redirects?: boolean | undefined;
  /** Generate a page for every removed slug, explaining the removal instead of 404ing. On by default. */
  readonly tombstones?: boolean | undefined;
  /** Generate a page for every alias. On by default. */
  readonly aliases?: boolean | undefined;
}

/**
 * Every route the site answers, in the shape the URLs actually take.
 *
 * Use this instead of `loader().generateParams()`, for two reasons:
 *
 * - `generateParams()` only knows pages, so an alias, an old slug or a removed page would get no HTML
 *   at all — and on a static host that is a 404 rather than the redirect or the explanation the
 *   resolver is ready to give.
 * - with `latestAtRoot`, the newest release's URLs drop the version segment while its slugs keep it.
 *   Params built from slugs would generate `/docs/4.0.0/guide/a` for a page whose URL is
 *   `/docs/guide/a`, and every one of those links would 404.
 */
export function staticParams<TSlug extends string = "slug">(source: OverlaySource, options: StaticParamsOptions = {}): Record<TSlug, string[]>[] {
  const key = (options.param ?? "slug") as TSlug;
  const wanted = new Set<string>(["page"]);
  if (options.redirects !== false) wanted.add("redirect");
  if (options.tombstones !== false) wanted.add("deleted");
  if (options.aliases !== false) wanted.add("alias");

  const params: Record<TSlug, string[]>[] = [];
  const seen = new Set<string>();

  // The scope is part of every URL of a scoped documentation, so it is part of every param.
  const scope = source.scope === undefined ? [] : [source.scope];

  for (const info of source.versions) {
    // The version served at the base URL is addressed without its segment.
    const prefix = info.isRoot ? [...scope] : [...scope, info.segment];

    for (const entry of source.overlay.getEntries(info.id)) {
      if (!wanted.has(entry.kind)) continue;

      const slugs = [...prefix, ...entry.slug];
      const identity = slugs.join("/");
      if (seen.has(identity)) continue;
      seen.add(identity);

      params.push({ [key]: slugs } as Record<TSlug, string[]>);
    }
  }

  return params;
}

/** Slugs of one kind, for a caller that wants to compose the list itself. */
export function slugsOfKind(source: OverlaySource, kind: "page" | "alias" | "redirect" | "deleted"): { version: string; slug: Slug }[] {
  const found: { version: string; slug: Slug }[] = [];
  for (const info of source.versions) {
    for (const entry of source.overlay.getEntries(info.id)) {
      if (entry.kind === kind) found.push({ version: info.id, slug: entry.slug });
    }
  }
  return found;
}
