# Example: Fumadocs + Next.js, five versions

Executable documentation. Five version folders exercise every case the engine handles, and
`scripts/assert-output.mjs` asserts the **exported HTML** in `postbuild` — so this is the end-to-end
test as much as the demo.

```bash
npm ci                  # from the repository root
npm run build           # the packages first: this app consumes their dist/
npm run build:example
npx serve out
```

## What the content covers

| Path                     | What it demonstrates                                                           |
| ------------------------ | ------------------------------------------------------------------------------ |
| `1.0.0/`                 | the complete tree; everything else inherits from here                          |
| `2.0.0/guide/intro.md`   | an override — 3.0.0 and 4.0.0 inherit _this_ copy, 1.0.0 keeps its own         |
| `2.0.0/guide/new-api.md` | a rename; `guide/old-api` redirects from 2.0.0 on, and is still a 200 in 1.0.0 |
| `3.0.0/guide/stays.md`   | a tombstone with `replacedBy`, so the removal explains itself                  |
| `3.0.0/guide/added.md`   | a page added under an inherited **exhaustive** `pages` list                    |
| `4.0.0/guide/stays.md`   | re-added after removal                                                         |
| `1.0.0/api/index.md`     | an alias, served with a canonical                                              |
| `next/`                  | the unreleased channel                                                         |

The newest release is 4.0.0 and sits at `/docs`, so `/docs/guide/setup` is 4.0.0 and
`/docs/1.0.0/guide/setup` the old one — the Docusaurus URL shape.

## Two things worth reading the source for

`lib/source.ts` is the entire integration: `docs.toFumadocsSource()` goes through `overlaySource()`,
and `loader()` gets `url`. That is the whole diff against an unversioned site.

`app/docs/[[...slug]]/page.tsx` uses `staticParams(overlay)` rather than `source.generateParams()`.
The loader knows only pages, so the alias, the old slug and the removed page would get no HTML at all —
and under `output: "export"` that means a 404 instead of the answer the resolver had ready.

## Hot reload

`overlayDynamicSource()` keeps the projection rebuildable. Give it the source as a **function** so the
engine re-reads it, and feed the watcher's paths to `invalidate()`:

```ts
const dynamic = overlayDynamicSource({ source: () => docs.toFumadocsSource(), channels: ["next"] });
const output = dynamicLoader(dynamic.source, { baseUrl: "/docs", url: dynamic.current.url });

// on a file change
const { versions } = dynamic.invalidate([changedPath]);
await output.revalidate();
// `versions` is exactly the set whose routes went stale — editing 1.0.0/guide/intro.md refreshes
// /docs/1.0.0/guide/intro and every version that inherits it, and nothing else.
```

This app is built statically, so it uses the static projection. The dynamic API is unit-tested in
`packages/adapters/fumadocs/src/dynamic.test.ts`.

## Notes

`next.config.mjs` sets `turbopack.root` to the monorepo root (npm hoists `next` and `react` there) and
`experimental.useTypeScriptCli` (the repo builds its libraries with TypeScript 7, which does not expose
the compiler API Next.js uses).
