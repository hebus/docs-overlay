# docs-overlay — several documentations

Two products, `alpha` and `beta`, on one site. Each has its own versions, its own `latest`, and its own
place in the URL. Alpha is at `2.0.0` while beta is still at `1.0.0`, which is the whole point: a
monorepo releases its packages on separate schedules.

```bash
npm run build -w docs-overlay-example-multi
```

`postbuild` runs `scripts/assert-output.mjs` against the exported HTML, so the build fails rather than
shipping a site that looks fine. What it pins:

- both products hold `guide/shared.md`, and each serves **its own** — the collision one loader would
  otherwise suffer;
- `only-alpha` is inherited by alpha `2.0.0` from alpha `1.0.0`, and never appears under beta;
- a product that owns a page claims no inheritance;
- a scope nobody declared gets no HTML at all, rather than being looked up as a page of some product's
  newest version.

The layout is the one a real site already has: **one** collection over `content/docs`, with the product
as a folder inside it, and `content/docs/<product>/<version>/…` below that. `lib/source.ts` is the file
worth reading — one `overlaySource()` per product, one `loader()` for all of them.

The step-by-step configuration is on the site, under
[Several documentations](https://hebus.github.io/docs-overlay/docs/multiple-products/).
