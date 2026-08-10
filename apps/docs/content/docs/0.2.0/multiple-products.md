---
title: Several documentations
description: One site, one product per scope, each with its own versions.
---

A monorepo that publishes three packages releases them on three schedules. `2.0.0` of one has nothing
to do with `2.0.0` of another, so one version list for the whole site would be wrong for at least two
of them.

A **scope** is one documentation among several: its own version folders, its own version list, its own
`latest`. Products stay independent; the site stays one site.

## You probably do not need this

If your site documents **one** thing, stop here. Leave `scope` out and everything on the other pages
applies unchanged — the option exists for sites that serve several products, and a site that declares
no scope behaves exactly as if the option had never been added.

## Folders

The scope is a folder, and the version folders sit inside it:

```
content/docs/
  alpha/
    1.0.0/          complete tree, frozen
    2.0.0/          differences only
    next/           work in progress
  beta/
    1.0.0/
    next/
```

Each product inherits along **its own** chain. `beta/next` falls back to `beta/1.0.0`, never to
anything under `alpha/`. Two products may hold the same slug — `alpha/1.0.0/guide/setup.md` and
`beta/1.0.0/guide/setup.md` — and they stay distinct pages.

## Configuration

One collection covers every product, because the scope is just a folder inside it:

```ts
// source.config.ts
import { pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/config";
import { withOverlay } from "docs-overlay-fumadocs/schema";

export const docs = defineDocs({
  dir: "content/docs",
  docs: { schema: withOverlay(pageSchema) }
});
```

Then one `overlaySource()` per product, and **one** `loader()` for all of them:

```ts
// lib/source.ts
import { loader } from "fumadocs-core/source";
import { docs } from "collections/server";
import { overlaySource, type OverlaySource } from "docs-overlay-fumadocs";

const content = () => docs.toFumadocsSource();

export const alpha = overlaySource({ source: content, scope: "alpha", channels: ["next"], latestAtRoot: true });
export const beta = overlaySource({ source: content, scope: "beta", channels: ["next"], latestAtRoot: true });

export const overlays: readonly OverlaySource[] = [alpha, beta];

/** The documentation a request belongs to: its scope is the first segment. */
export function overlayOf(slugs: readonly string[] | undefined): OverlaySource | undefined {
  return overlays.find(overlay => overlay.scope === slugs?.[0]);
}

export const source = loader({
  baseUrl: "/docs",
  source: { alpha: alpha.source, beta: beta.source },
  // Each product hides its own newest version's segment, so the URL belongs to the overlay the slugs
  // came from.
  url: slugs => (overlayOf(slugs) ?? alpha).url(slugs)
});
```

**One loader, not one per product.** The loader owns the file system `createRelativeLink()` reads:
split it and `./sibling.md` stops resolving. One loader also means one page tree and one search index.

The catch-all route gains a single lookup — which documentation is this? — and is otherwise unchanged:

```tsx
// app/docs/[[...slug]]/page.tsx
const overlay = overlayOf(slug);
if (overlay === undefined) notFound();

const route = resolveRoute(overlay, slug);
if (route.kind === "not-found") notFound();
```

Ask the wrong overlay and you get `not-found` — the right status for the wrong reason, which hides
real 404s. `resolveRoute()` refuses a scope that is not its own rather than looking for it as a page.

`generateStaticParams()` is the sum of the products, each already carrying its scope:

```tsx
export function generateStaticParams() {
  return overlays.flatMap(overlay => staticParams(overlay));
}
```

And search tags carry both, so a query can narrow to a product, a version, or both:

```ts
buildIndex: page => ({ /* … */ tag: searchTagsOf(overlayOf(page.slugs) ?? alpha, page) })
```

Use `searchTagsOf()` and not `versionTagOf()` here: the first slug segment is now the product, so
tagging with it would filter every version of that product while claiming to filter one version.

## URLs

With `latestAtRoot`, each product hides **its own** newest version — never its scope:

| URL                             | Serves                                  |
| ------------------------------- | --------------------------------------- |
| `/docs/alpha/guide/setup`       | alpha, newest release                   |
| `/docs/alpha/1.0.0/guide/setup` | alpha, an older release                 |
| `/docs/alpha/next/guide/setup`  | alpha, unreleased channel               |
| `/docs/beta/guide/setup`        | beta, newest release — a different page |

## What does not work

- **Relative links across products.** `../../beta/guide/setup.md` from an alpha page will not resolve:
  a relative link is resolved inside the documentation it was written in. Use an absolute URL, and
  accept that it names a version implicitly.
- **The search index grows with the product of both axes** — versions times products. Tag it, filter
  it on the client, and measure the exported index before assuming it is free.
- **The sidebar sections are the versions**, not the products, because that is where `root: true`
  goes. The product is the folder above; a switcher between products is yours to render, as the
  version switcher already is.

A working site is in `examples/fumadocs-multi`, and its `postbuild` asserts the exported HTML —
including that one product never inherits from another.
