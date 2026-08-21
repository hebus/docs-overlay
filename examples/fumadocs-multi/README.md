# Two packages, two release schedules, one site

A monorepo publishes its packages on separate schedules, so one version list cannot describe them all.
This example is the proof that it does not have to: `alpha` is at `2.0.0` while `beta` is still at
`1.0.0`, each with its own versions, its own `latest` and its own place in the URL — served by **one**
Fumadocs `loader()`.

That makes it the multi-package answer as much as the multi-product one: replace `alpha` and `beta` with
`ui` and `react`, or with two SDKs, and nothing else changes.

## Run it

From the repository root, because the example consumes the workspace packages:

```bash
npm ci
npm run build                    # the packages first
npm run build:example:multi      # this site, plus its end-to-end assertions
npm --prefix examples/fumadocs-multi start
```

`npm --prefix examples/fumadocs-multi run dev` for the dev server instead.

## The layout

The product is a folder, and the version folders live inside it. One collection over `content/docs`,
exactly as an unversioned site already has:

```text
content/docs/
  alpha/
    1.0.0/          index.md · guide/shared.md · guide/only-alpha.md
    2.0.0/          guide/shared.md          — only what changed
  beta/
    1.0.0/          index.md · guide/shared.md
```

Both products hold a `guide/shared.md`, on purpose: that is the collision one loader would otherwise
suffer. And `alpha/2.0.0` holds a single file, so `index` and `guide/only-alpha` reach it by
inheritance — within alpha, and never across into beta.

## The whole integration

[`lib/source.ts`](lib/source.ts) is the file worth reading. One `overlaySource()` per product, one
`loader()` for all of them:

```ts
const content = () => docs.toFumadocsSource();

export const alpha = overlaySource({ source: content, baseUrl: "/docs", scope: "alpha", channels: ["next"], latestAtRoot: true });
export const beta = overlaySource({ source: content, baseUrl: "/docs", scope: "beta", channels: ["next"], latestAtRoot: true });

export const source = loader({
  baseUrl: "/docs",
  source: { alpha: alpha.source, beta: beta.source },
  url: slugs => (overlayOf(slugs) ?? alpha).url(slugs)
});
```

**One loader rather than one per product**, because the loader owns the file system that
`createRelativeLink()` reads: split it and a relative link stops resolving. Keeping one also means one
page tree and one search index. The `scope` is what makes that safe — without it both products would
emit `1.0.0/guide/shared.md` and `meta.json`, and whichever registered second would silently win.

`url` has to be built by the overlay the slugs belong to, since each product drops its own root
version's segment.

## What the build asserts

`postbuild` runs [`scripts/assert-output.mjs`](scripts/assert-output.mjs) against the exported HTML — 16
assertions, so the build fails rather than shipping a site that merely looks fine:

- both products serve **their own** `guide/shared`, and alpha's older version still serves the original;
- `only-alpha` is inherited by alpha `2.0.0` from `1.0.0` and says "Unchanged since 1.0.0" — while the
  version that _owns_ a page shows no such notice;
- beta never gains alpha's page, and alpha's slug under beta is not routed;
- a product nobody declared gets no HTML at all, rather than being looked up as a page of some other
  product's newest version;
- each product's pages are labelled with their own product and version.

## What it does not do

- **No relative links between products.** They are separate documentations that happen to share a site.
- **The search index grows with versions × products.** Filter it — `searchTagsOf()` returns both tags.
- **The sidebar's sections are the versions**, one per product, not a cross-product view.
- Versioned i18n is not supported in `0.x`, here or anywhere else.

## Read next

- [Several documentations](https://hebus.github.io/docs-overlay/docs/multiple-products/) — the
  step-by-step configuration.
- [`examples/fumadocs-next`](../fumadocs-next) — one documentation, five versions, covering override,
  rename, tombstone, re-add, alias and navigation inheritance.
