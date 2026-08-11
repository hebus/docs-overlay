# docs-overlay

**Version your documentation without duplicating it.** Author only the diff between versions — this
package resolves the rest.

[![npm](https://img.shields.io/npm/v/docs-overlay?color=cb3837)](https://www.npmjs.com/package/docs-overlay)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://github.com/hebus/docs-overlay/blob/main/packages/core/package.json)
[![types included](https://img.shields.io/npm/types/docs-overlay)](https://github.com/hebus/docs-overlay/tree/main/packages/core)
[![licence MIT](https://img.shields.io/npm/l/docs-overlay?color=blue)](https://github.com/hebus/docs-overlay/blob/main/LICENSE)

Documentation frameworks version by snapshot: cutting a release copies the whole tree. A typo present
in four versions then takes four edits, a reviewer cannot see what actually changed between two
releases, and the repository grows by one full tree per release.

This package is the **engine** that inverts that. It knows versions, pages, slugs, metadata,
inheritance and resolution — and nothing about any documentation framework.

## Install

```bash
npm install docs-overlay
```

If you use Fumadocs or Docusaurus, install an adapter instead — you will not call this API directly:

| Adapter                                                                            | For                                    |
| ---------------------------------------------------------------------------------- | -------------------------------------- |
| [`docs-overlay-fumadocs`](https://www.npmjs.com/package/docs-overlay-fumadocs)     | Fumadocs / Next.js                     |
| [`docs-overlay-docusaurus`](https://www.npmjs.com/package/docs-overlay-docusaurus) | Docusaurus                             |
| [`docs-overlay-cli`](https://www.npmjs.com/package/docs-overlay-cli)               | `cut`, `check`, `prune`, `materialize` |

## What it does

Versions are top-level folders, ordered by semver, with declared non-semver folders — channels such as
`next` — sorted last. There is no `versions.json`: the list of versions _is_ the list of folders.

```text
content/docs/
  1.0.0/          the complete tree
  3.0.0/          only what changed
  next/           work in progress — empty, so it inherits everything
```

Resolution walks up that chain and stops at the nearest version that owns the file:

```text
resolve("next", "guide/setup")

  next/guide/setup.md        not here
  3.0.0/guide/setup.md       not here
  1.0.0/guide/setup.md       served, with the defining version and the number of hops
```

Directives live in the frontmatter under a single `overlay:` key, in the version that introduces the
change: `renamedFrom` on a renamed file, `deleted: true` with an optional `replacedBy` on a tombstone,
`aliases` for a second URL. Priority inside a version is fixed — `own file > tombstone >
rename/redirect > alias > inherited` — so renaming onto a slug that already exists has one answer.

## The API, in about twenty lines

```ts
import { createOverlay } from "docs-overlay";

// One entry per file. The first path segment is the version; `meta` is opaque to the core.
const overlay = createOverlay({
  source: [
    { path: "1.0.0/guide/intro.md", kind: "page", meta: {} },
    { path: "3.0.0/guide/intro.md", kind: "page", meta: {} }
  ],
  channels: ["next"]
});

overlay.versions; // oldest first, each with the version it inherits from
overlay.latest; // highest stable release, never a channel
overlay.getPages("3.0.0"); // every page the version serves, own and inherited
overlay.getEntries("3.0.0"); // every slug it answers for: page, alias, redirect, deleted
overlay.diagnostics(); // duplicate slugs, tombstones with no target, redirect cycles…

const outcome = overlay.resolve("3.0.0", ["guide", "intro"]);
```

`resolve()` is exhaustive and **terminal** — redirect chains are collapsed when the index is built, so
`to` always names something servable and a caller never loops:

| `outcome.kind`    | Carries                                      |
| ----------------- | -------------------------------------------- |
| `own`             | `page` — a file in this version's own folder |
| `inherited`       | `page`, whose `source.definedIn` wrote it    |
| `alias`           | `page` and the `canonical` slug              |
| `redirect`        | `to`, `permanent`, `reason`                  |
| `deleted`         | `deletedIn`, `lastAvailable?`, `replacedBy?` |
| `missing`         | — the version exists but never had this page |
| `unknown-version` | `nearest?` — a different case from `missing` |

Nothing throws on bad content: every problem is a `Diagnostic` with a severity and one of twelve codes,
so a consumer decides whether a duplicate slug fails the build or only warns.

The core is synchronous and performs **no I/O** — you hand it entries that something else read. It is
also memoised: folding a version happens once, and 10 000 `resolve()` calls trigger no additional fold.
`getDependents(path)` and `invalidate(paths)` are there so a dev server can rebuild only the versions a
changed file actually feeds.

The full surface, and what an adapter has to get right, is in
[Writing an adapter](https://hebus.github.io/docs-overlay/docs/adapters/).

## Zero dependencies, and it is checked

`dependencies` and `peerDependencies` are both empty, there is no `node:*` import, and the package is
ESM only. That is not a claim in a readme — three guards fail the build if it slips, because npm hoists
an adapter's dependencies to where the core could resolve them and TypeScript would never notice:

- a static architecture test forbidding `react`, `next`, `fumadocs-*`, `astro`, `nextra`, `vitepress`
  and every Node built-in, and requiring both dependency fields to stay empty;
- `npm run verify:independence`, which packs this package with `npm pack` and runs a probe against it
  in a temporary directory with **no `node_modules` at all**;
- `npm run typecheck:packaged`, which typechecks the adapters against the built `.d.ts` with no source
  alias in play — that is what validates the published `exports` map.

## Documentation

**[hebus.github.io/docs-overlay](https://hebus.github.io/docs-overlay)** — served by this package, so
the site is its own proof. Start with
[Authoring](https://hebus.github.io/docs-overlay/docs/authoring/) and
[Resolution](https://hebus.github.io/docs-overlay/docs/resolution/).

Source, issues and the monorepo: [github.com/hebus/docs-overlay](https://github.com/hebus/docs-overlay).

## Licence

[MIT](https://github.com/hebus/docs-overlay/blob/main/LICENSE)
