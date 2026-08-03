# docs-overlay-fumadocs

Fumadocs adapter for [docs-overlay](../../../README.md) — versioned documentation where you author
only the diff between versions.

It re-projects the `StaticSource` that `fumadocs-mdx` already produced through the overlay resolver,
then hands the result back to `loader()`. Fumadocs keeps compiling the MDX; the core only ever sees
paths and opaque metadata.

> [!IMPORTANT]
> `pageSchema` is a zod object in `strip` mode, so an `overlay:` key in frontmatter is **silently
> dropped** before it reaches `page.data`. Widen your schema with `withOverlay(pageSchema)` from
> `docs-overlay-fumadocs/schema`, or no directive will have any effect — and nothing will tell you
> why.

```ts
// lib/source.ts
import { loader } from "fumadocs-core/source";
import { docs } from "collections/server";
import { overlaySource } from "docs-overlay-fumadocs";

export const overlay = overlaySource({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
  channels: ["next"],
  latestAtRoot: true
});

export const source = loader({
  baseUrl: "/docs",
  source: overlay.source,
  url: overlay.url
});
```

One `loader()` handles every version, with the version as the first slug segment. That keeps the page
tree, the search index and `generateParams()` coherent, and keeps a relative link such as `./b.md`
inside the version it was written in.

## API

| Export                                   | Purpose                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `overlaySource(options)`                 | The projection: `source` for `loader()`, `url` for its URLs, `versions`, `latest`, `root`, `diagnostics`. |
| `resolveRoute(overlay, slugs)`           | What the catch-all route should do: `page`, `redirect`, `gone` or `not-found`.                            |
| `staticParams(overlay)`                  | Every routable slug in the URL shape — pages, aliases, old slugs, removed pages.                          |
| `switchVersion(overlay, slugs, to)`      | Where the version switcher should go, with `exact: false` when the page does not exist there.             |
| `versionTabs(overlay)`                   | Data for a switcher, built explicitly rather than auto-detected.                                          |
| `versionTree(source, segment)`           | The sidebar tree scoped to one version.                                                                   |
| `findOrphanPages(source)`                | Pages that are routed but that no tree reaches.                                                           |
| `versionTagOf(page)`                     | Version segment of a page, for tagging a search index.                                                    |
| `appendRest()` / `strictMeta()`          | How an inherited `meta.json` adapts to a newer version.                                                   |
| `toNextRedirects` / `toNetlifyRedirects` | Redirect rules for a server deployment.                                                                   |
| `overlayDynamicSource(options)`          | Development variant, rebuilt on `invalidate()`.                                                           |
| `withOverlay(schema)`                    | From `docs-overlay-fumadocs/schema`. Mandatory — see above.                                               |

## Two things that will bite otherwise

**`generateStaticParams()` must use `staticParams(overlay)`, not `source.generateParams()`.** The
loader knows only pages, so an alias, an old slug or a removed page would get no HTML — and on a static
host that is a 404 instead of the redirect or explanation the resolver was ready to give. With
`latestAtRoot`, params built from slugs would also keep a version segment the URLs drop, and every one
of those links would 404.

**Filter the search index by version.** A page served by five versions produces five index entries
pointing at the same `structuredData`, so an unfiltered query returns five copies. Tag with
`versionTagOf(page)` and filter on the client.

## Peer dependencies

| Package         | Range      | Required                        |
| --------------- | ---------- | ------------------------------- |
| `fumadocs-core` | `>=16 <17` | yes                             |
| `zod`           | `^4`       | only for the `./schema` subpath |

No React at runtime: the `ReactNode` types it touches are `import type` only, and the version switcher
component lives in your app, not here. See
[`examples/fumadocs-next/lib/version-select.tsx`](../../../examples/fumadocs-next/lib/version-select.tsx).

## Known limitation: i18n

Fumadocs' `i18n.parser: "dir"` consumes the first path segment — the same one this adapter uses for the
version. They cannot both own it, and `0.x` does not support the combination.
