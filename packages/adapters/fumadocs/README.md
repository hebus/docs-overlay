# docs-overlay-fumadocs

**Versioned documentation for Fumadocs, without copying your docs.**

[![npm](https://img.shields.io/npm/v/docs-overlay-fumadocs?color=cb3837)](https://www.npmjs.com/package/docs-overlay-fumadocs)
[![licence MIT](https://img.shields.io/npm/l/docs-overlay-fumadocs?color=blue)](https://github.com/hebus/docs-overlay/blob/main/LICENSE)
[![documentation](https://img.shields.io/badge/docs-hebus.github.io-blue)](https://hebus.github.io/docs-overlay)

Fumadocs has no version model of its own, so the usual answer is a folder per version and a full copy
of the tree per release. From then on a typo present in four versions takes four edits, and nobody can
see from git what actually changed for readers between two releases.

This adapter gives Fumadocs the other model: the oldest version folder holds the complete tree, every
newer folder holds **only what it changed**, and everything else is inherited. A fix lands once. Cutting
a release is a folder rename. A renamed page keeps a permanent redirect, and a removed one can explain
itself instead of 404ing.

It re-projects the `StaticSource` that `fumadocs-mdx` already produced through the overlay resolver,
then hands the result back to `loader()`. Fumadocs keeps compiling the MDX; the core only ever sees
paths and opaque metadata — nothing is written to disk.

## Install

```bash
npm install docs-overlay docs-overlay-fumadocs
```

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

| Export                                   | Purpose                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overlaySource(options)`                 | The projection: `source` for `loader()`, `url` for its URLs, `versions`, `latest`, `root`, `diagnostics`.                                               |
| `resolveRoute(overlay, slugs)`           | What the catch-all route should do: `page`, `redirect`, `gone` or `not-found`. A `page` carries `inheritedFrom` when the version does not own the file. |
| `staticParams(overlay)`                  | Every routable slug in the URL shape — pages, aliases, old slugs, removed pages.                                                                        |
| `switchVersion(overlay, slugs, to)`      | Where the version switcher should go, with `exact: false` when the page does not exist there.                                                           |
| `versionTabs(overlay)`                   | Data for a switcher, built explicitly rather than auto-detected.                                                                                        |
| `versionTree(source, segment)`           | The sidebar tree scoped to one version.                                                                                                                 |
| `findOrphanPages(source)`                | Pages that are routed but that no tree reaches.                                                                                                         |
| `versionTagOf(page)`                     | Version segment of a page, for tagging a search index.                                                                                                  |
| `searchTagsOf(overlay, page)`            | Product **and** version tags, for a site serving several documentations.                                                                                |
| `appendRest()` / `strictMeta()`          | How an inherited `meta.json` adapts to a newer version.                                                                                                 |
| `toNextRedirects` / `toNetlifyRedirects` | Redirect rules for a server deployment.                                                                                                                 |
| `overlayDynamicSource(options)`          | Development variant, rebuilt on `invalidate()`.                                                                                                         |
| `withOverlay(schema)`                    | From `docs-overlay-fumadocs/schema`. Mandatory — see above.                                                                                             |

## Telling readers a page is inherited

Inheritance is invisible by default: `/docs/next/guide/a` and `/docs/guide/a` render the same file, and
nothing in the page says which version wrote it. A `page` resolution therefore carries
`inheritedFrom: { version, hops }` whenever the browsing version does not own the file — absent when it
does, so `if (route.inheritedFrom)` is the whole test.

```tsx
// app/docs/[[...slug]]/page.tsx
{route.inheritedFrom === undefined ? null : <p>Unchanged since {route.inheritedFrom.version}</p>}
```

Do not link to that version: it serves the very same file, so the link returns identical prose and
costs the reader their place.

### Turning the notice off

`inheritedNotice` is a **shared switch, not a feature toggle.** This package renders nothing, so it
cannot hide anything by itself. It has two halves, and both are yours to write.

**1. Declare the choice** where you build the source:

```ts
// lib/source.ts
export const overlay = overlaySource({
  source: docs.toFumadocsSource(),
  channels: ["next"],
  inheritedNotice: false // defaults to true
});
```

**2. Honour it** where you render:

```tsx
// app/docs/[[...slug]]/page.tsx
{overlay.inheritedNotice && route.inheritedFrom !== undefined ? (
  <p>Unchanged since {route.inheritedFrom.version}</p>
) : null}
```

> [!IMPORTANT]
> Write only the first half and the option does nothing: your page goes on rendering the notice
> whatever the value, with nothing to explain why. The reason to put the flag here rather than in a
> constant of your own is that one declaration then answers the question for every route — and for
> anything else that comes to ask, such as a second layout or a print stylesheet.

Turning it off never changes what `resolveRoute()` reports: `inheritedFrom` is still there. Withholding
the fact would leave you unable to do anything else with it — count it, log it, or show it only past a
number of `hops`.

## Three things that will bite otherwise

**`generateStaticParams()` must use `staticParams(overlay)`, not `source.generateParams()`.** The
loader knows only pages, so an alias, an old slug or a removed page would get no HTML — and on a static
host that is a 404 instead of the redirect or explanation the resolver was ready to give. With
`latestAtRoot`, params built from slugs would also keep a version segment the URLs drop, and every one
of those links would 404.

**Filter the search index by version.** A page served by five versions produces five index entries
pointing at the same `structuredData`, so an unfiltered query returns five copies. Tag with
`versionTagOf(page)` and filter on the client.

**Open a version landing page after your first deploy.** `/docs/1.0.0/` is a path segment made of digits
and dots, and some static servers read that as a filename with an extension — they then never look for
`index.html` inside the directory, so the landing page answers with a directory listing while every page
beneath it works. GitHub Pages and `http-server` handle it; the `serve` package does not, with no setting
that fixes it. The build is not at fault when this happens, which is what makes it worth checking once
deliberately.

## Several documentations on one site

A monorepo publishing three packages releases them on three schedules, so one version list cannot
describe all three. Give each product a `scope` and it gets its own versions, its own `latest`, and its
own place in the URL — `/docs/alpha/2.0.0/…` — while several scoped instances feed **one** `loader()`,
which keeps one page tree, one search index, and relative links that resolve.

```ts
export const alpha = overlaySource({ source: content, scope: "alpha", channels: ["next"] });
export const beta = overlaySource({ source: content, scope: "beta", channels: ["next"] });
```

Leave `scope` out and nothing changes: a single-product site never sees it.

The full walkthrough — folders, the route, `staticParams()`, search tags, and what does not work — is
on the site: **[Several documentations](https://hebus.github.io/docs-overlay/docs/multiple-products/)**.
A working site is in
[`examples/fumadocs-multi`](https://github.com/hebus/docs-overlay/tree/main/examples/fumadocs-multi),
whose `postbuild` asserts the exported HTML.

## Peer dependencies

| Package         | Range      | Required                        |
| --------------- | ---------- | ------------------------------- |
| `fumadocs-core` | `>=16 <17` | yes                             |
| `zod`           | `^4`       | only for the `./schema` subpath |

No React at runtime: the `ReactNode` types it touches are `import type` only, and the version switcher
component lives in your app, not here. See
[`examples/fumadocs-next/lib/version-select.tsx`](https://github.com/hebus/docs-overlay/blob/main/examples/fumadocs-next/lib/version-select.tsx).

## Known limitation: i18n

Fumadocs' `i18n.parser: "dir"` consumes the first path segment — the same one this adapter uses for the
version. They cannot both own it, and `0.x` does not support the combination.

## Not on Fumadocs?

The content model is the adapter's, not Fumadocs' — the engine knows nothing about any framework.

- [`docs-overlay`](https://www.npmjs.com/package/docs-overlay) — the engine, if you are writing your own
  adapter for Astro, VitePress or a script of your own.
- [`docs-overlay-docusaurus`](https://www.npmjs.com/package/docs-overlay-docusaurus) — the same content
  model on Docusaurus, materialised into the snapshot tree it insists on reading.
- [`docs-overlay-cli`](https://www.npmjs.com/package/docs-overlay-cli) — `cut`, `check` and `prune` work
  on any repository following the folder convention, Fumadocs included.

## Documentation

**[hebus.github.io/docs-overlay](https://hebus.github.io/docs-overlay)** — the concepts common to every
adapter: [Authoring](https://hebus.github.io/docs-overlay/docs/authoring/) and
[Resolution](https://hebus.github.io/docs-overlay/docs/resolution/). A complete working site, with
end-to-end assertions on its exported HTML, is in
[`examples/fumadocs-next`](https://github.com/hebus/docs-overlay/tree/main/examples/fumadocs-next).

## Licence

[MIT](https://github.com/hebus/docs-overlay/blob/main/LICENSE)
