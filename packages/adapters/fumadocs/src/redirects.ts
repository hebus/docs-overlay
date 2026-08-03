import type { RedirectRule } from "@docs-overlay/core";

import type { OverlaySource } from "./overlay-source.js";

export interface NextRedirect {
  readonly source: string;
  readonly destination: string;
  readonly permanent: boolean;
}

/**
 * Redirect rules for `next.config.mjs`.
 *
 * Only useful on a server deployment. **Next ignores `redirects` under `output: "export"`**, which is
 * how the docs sites this was built for are deployed — use {@link redirectParams} there.
 */
export function toNextRedirects(source: OverlaySource): NextRedirect[] {
  return rulesOf(source).map(({ rule, segment }) => ({
    source: source.url([segment, ...rule.from]),
    destination: source.url([segment, ...rule.to]),
    permanent: rule.permanent
  }));
}

/** Netlify `_redirects` file contents. */
export function toNetlifyRedirects(source: OverlaySource): string {
  return toNextRedirects(source)
    .map(redirect => `${redirect.source} ${redirect.destination} ${redirect.permanent ? 301 : 302}`)
    .join("\n");
}

/**
 * Extra `generateStaticParams()` entries so every old slug gets a real HTML file under
 * `output: "export"`, where `next.config` redirects do nothing.
 *
 * The catch-all route already handles these slugs: `resolveRoute()` answers `kind: "redirect"` and the
 * page renders a `<meta http-equiv="refresh">` plus a canonical link. Nothing is added to the page
 * tree or to the search index, because no virtual file is created — which is exactly what a synthetic
 * page in the content tree would have got wrong.
 */
export function redirectParams<TSlug extends string = "slug">(source: OverlaySource, slug: TSlug = "slug" as TSlug): Record<TSlug, string[]>[] {
  const latestSegment = source.latest?.url === source.baseUrl ? source.latest.segment : undefined;

  return rulesOf(source).map(({ rule, segment }) => {
    // Mirror the URL shape: the newest release is addressed without its segment.
    const slugs = segment === latestSegment ? [...rule.from] : [segment, ...rule.from];
    return { [slug]: slugs } as Record<TSlug, string[]>;
  });
}

function rulesOf(source: OverlaySource): { rule: RedirectRule; segment: string }[] {
  const rules: { rule: RedirectRule; segment: string }[] = [];
  for (const rule of source.overlay.getRedirects()) {
    const info = source.versionOf(rule.version);
    if (info !== undefined) rules.push({ rule, segment: info.segment });
  }
  return rules;
}
