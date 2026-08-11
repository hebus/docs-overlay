import type { MetadataRoute } from "next";

import { withBasePath } from "@/lib/base-path";
import { canonicalUrlOf } from "@/lib/canonical";
import { source } from "@/lib/source";

// Absolute URLs, since a sitemap has no notion of a relative one.
const ORIGIN = "https://hebus.github.io";

// Required under `output: "export"`, which refuses a metadata route that has not said it is static —
// there is no server to regenerate it against. The search route says the same thing as `revalidate`.
export const dynamic = "force-static";

// `trailingSlash: true`, so every real URL ends in one. Listing the other form invites a redirect hop.
const absolute = (path: string): string => `${ORIGIN}${withBasePath(path.endsWith("/") ? path : `${path}/`)}`;

/**
 * One entry per page, at the URL that should be indexed.
 *
 * The filter is the same question `canonicalUrlOf()` answers: a page that names another URL as its
 * canonical has no business being listed under its own. That keeps the sitemap free of the duplicates
 * inheritance necessarily produces, and it stays true by itself as versions are cut — the day a release
 * moves to the root, its pages become canonical and the ones inheriting them stop being listed, with
 * nothing here to change.
 *
 * `lastModified` is deliberately absent: the honest source for it is the git history of the file a page
 * resolves to, which is not available at build time here, and a date that is merely the build's would
 * tell a crawler every page changed on every deploy.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = source
    .getPages()
    .filter(page => canonicalUrlOf(page.slugs) === undefined)
    .map(page => ({ url: absolute(page.url) }));

  return [{ url: absolute("/") }, ...pages];
}
