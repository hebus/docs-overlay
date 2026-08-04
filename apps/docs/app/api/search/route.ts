import { createFromSource } from "fumadocs-core/search/server";

import { versionTagOf } from "docs-overlay-fumadocs";

import { source } from "@/lib/source";

// The index is written once, at build time; there is no server to revalidate against.
export const revalidate = false;

/**
 * The search index, exported as a file rather than served by a route.
 *
 * `staticGET` writes the whole database into the export; the browser downloads it and queries it
 * locally. The usual `GET` handler answers one query at a time, which needs a server at request
 * time — a static export on GitHub Pages has none, so that route 404s and the dialog reports
 * "no results" instead of an error.
 *
 * Each page is indexed once per version that serves it, all pointing at the same content, so the
 * entries carry the version segment as a tag. Without it a single query returns each of its hits
 * once per version — which for a site whose whole premise is inheritance would be most of them.
 */
export const { staticGET: GET } = createFromSource(source, {
  buildIndex: page => ({
    id: page.url,
    url: page.url,
    title: page.data.title,
    description: page.data.description,
    structuredData: page.data.structuredData,
    tag: versionTagOf(page)
  })
});
