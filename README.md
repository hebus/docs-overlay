# docs-overlay

**Version your documentation without duplicating it.** Author only the diff between versions — the
engine resolves the rest.

[![docs-overlay on npm](https://img.shields.io/npm/v/docs-overlay?label=docs-overlay&color=cb3837)](https://www.npmjs.com/package/docs-overlay)
[![CI](https://github.com/hebus/docs-overlay/actions/workflows/pull-request.yml/badge.svg?branch=main)](https://github.com/hebus/docs-overlay/actions/workflows/pull-request.yml)
[![core dependencies](https://img.shields.io/badge/core%20dependencies-0-brightgreen)](packages/core/package.json)
[![types included](https://img.shields.io/npm/types/docs-overlay)](packages/core)
[![licence MIT](https://img.shields.io/npm/l/docs-overlay?color=blue)](LICENSE)
[![documentation](https://img.shields.io/badge/docs-hebus.github.io-blue)](https://hebus.github.io/docs-overlay)

[Documentation](https://hebus.github.io/docs-overlay) · [Authoring](https://hebus.github.io/docs-overlay/docs/authoring/) ·
[Why not duplicate?](#why-not-duplicate-your-docs) · [npm](https://www.npmjs.com/package/docs-overlay)

Every documentation framework versions by snapshot: cutting a release copies the whole tree. From then
on a typo present in four versions takes four edits or survives in three of them, a reviewer cannot see
what actually changed between two releases, and the repository grows by one full tree per release.

`docs-overlay` inverts that. The oldest version folder holds the complete tree; every newer folder holds
**only what it changed** — an override, a new page, a rename, a tombstone. Everything else is inherited,
resolved at build time.

## The 30-second version

```text
Snapshot versioning                     docs-overlay

docs/                                   content/docs/
├── v1/                                 ├── v1/          the complete tree
│   ├── intro.md                        │   ├── intro.md
│   ├── guide.md                        │   ├── guide.md
│   └── api.md                          │   └── api.md
├── v2/                                 ├── v2/          only what changed
│   ├── intro.md   ← identical copy     │   └── guide.md
│   ├── guide.md                        │
│   └── api.md     ← identical copy     │
└── v3/                                 └── v3/          only what changed
    ├── intro.md   ← identical copy         └── api.md
    ├── guide.md   ← identical copy
    └── api.md
```

`v2` serves `intro` and `api` by inheriting them from `v1`. `v3` serves `intro` from `v1` and `guide`
from `v2`. Nothing is copied, so nothing can drift apart.

Resolution is a walk up the chain, and it stops at the nearest version that owns the file:

```text
resolve("v3", "intro")

  v3/intro.md      not here
  v2/intro.md      not here
  v1/intro.md      served — and the page can say "Unchanged since v1"
```

Cutting the next release is one command, and it moves a folder rather than copying a tree:

```bash
docs-overlay cut 2.0.0
```

On the real 216-page site this was built for, migrating two releases onto an overlay took **575 tracked
files down to 351** — 39% fewer — and the cut itself was 216 renames that git recorded at R100, with
**zero insertions and zero deletions**. The emptied channel folder inherits everything again.

## Why docs-overlay?

- **One copy of each page.** A fix lands once, in the version that owns the file, and every version
  inheriting it gets the fix.
- **The diff is the release note.** `git diff` between two version folders is exactly what changed for
  readers, with nothing to read past.
- **Cutting a release is cheap.** A folder rename. No snapshot to review, no `versions.json` to bump.
- **Removals explain themselves.** A tombstone can carry `replacedBy`, so an old URL gets an
  explanation instead of a 404, and a renamed page keeps a permanent redirect.
- **Nothing to keep in sync.** The list of versions _is_ the list of folders.
- **The core is framework-agnostic.** Zero dependencies, no Node built-ins, ESM. Frameworks are
  adapters on top of it.

## Works with your framework

```text
                          docs-overlay
                    framework-agnostic core
                       zero dependencies
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
 docs-overlay-          docs-overlay-           your adapter
   fumadocs               docusaurus                  │
        │                      │                      │
    Fumadocs              Docusaurus         Astro, VitePress, a script…
```

| Your setup         | Install                                                                                                         | How it works                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fumadocs / Next.js | `docs-overlay` + [`docs-overlay-fumadocs`](packages/adapters/fumadocs)                                          | Re-projects the source Fumadocs already read. One `loader()` serves every version. Nothing is written to disk.                                                 |
| Docusaurus         | `docs-overlay` + [`docs-overlay-docusaurus`](packages/adapters/docusaurus) + [`docs-overlay-cli`](packages/cli) | The adapter _plans_ the snapshot tree Docusaurus insists on reading; the CLI writes it as a prebuild step. URLs come out identical to a plain Docusaurus site. |
| Anything else      | `docs-overlay`                                                                                                  | The engine answers `(version, slug)` questions and knows nothing about frameworks. Writing an adapter never requires a change to the core.                     |
| Just the plumbing  | [`docs-overlay-cli`](packages/cli)                                                                              | `cut`, `check` and `prune` work on any repository that follows the folder convention.                                                                          |

> **Not supported in `0.x`: i18n on top of versions.** Fumadocs' `i18n.parser: "dir"` claims the same
> first path segment as the version, and Docusaurus keys its translations by version. Neither
> combination is folded yet.

## Install

### Fumadocs / Next.js

```bash
npm install docs-overlay docs-overlay-fumadocs
```

> [!IMPORTANT]
> **`pageSchema` is a zod object in `strip` mode**, so an `overlay:` key in frontmatter is silently
> dropped before it reaches `page.data`. Widen the schema with `withOverlay()`. Skip this and everything
> appears to work — except that no directive has any effect, with no error to explain why.

```ts
// source.config.ts
import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { withOverlay } from "docs-overlay-fumadocs/schema";

export const docs = defineDocs({
  dir: "content/docs",
  docs: { schema: withOverlay(pageSchema) }
});

export default defineConfig({});
```

```ts
// lib/source.ts
import { loader } from "fumadocs-core/source";
import { docs } from "collections/server";
import { overlaySource } from "docs-overlay-fumadocs";

export const overlay = overlaySource({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
  channels: ["next"],
  // `/docs/...` is the newest release, `/docs/1.0.0/...` an older one.
  latestAtRoot: true,
  labels: { next: "Next 🚧" }
});

export const source = loader({ baseUrl: "/docs", source: overlay.source, url: overlay.url });
```

The catch-all route — `resolveRoute()` and its four outcomes, and why `generateStaticParams()` must use
`staticParams(overlay)` — is in the [adapter's readme](packages/adapters/fumadocs#readme). The complete
file that compiles is [`examples/fumadocs-next/app/docs/[[...slug]]/page.tsx`](examples/fumadocs-next/app/docs).

### Docusaurus

```bash
npm install -D docs-overlay docs-overlay-cli docs-overlay-docusaurus
```

```json
{
  "scripts": {
    "materialize": "docs-overlay materialize",
    "verify": "docs-overlay materialize --check",
    "prebuild": "npm run materialize",
    "prestart": "npm run materialize"
  }
}
```

You edit `content/docs/`; `docs/`, `versioned_docs/`, `versioned_sidebars/` and `versions.json` become
build output. Put `docs-overlay materialize --check` in CI — it turns an edit made in the generated tree
into a failed build instead of an edit that disappears without a trace. The full walkthrough is
[Versioning Docusaurus documentation without snapshots](https://hebus.github.io/docs-overlay/docs/staying-on-docusaurus/),
and [`examples/docusaurus-classic`](examples/docusaurus-classic) is a working site you can clone and run.

### Any other framework

```bash
npm install docs-overlay
```

```ts
import { createOverlay } from "docs-overlay";

const overlay = createOverlay({ source: entries, channels: ["next"] });
const outcome = overlay.resolve("2.0.0", ["guide", "intro"]);

// outcome.kind is exactly one of:
//   own · inherited · alias · redirect · deleted · missing · unknown-version
// Each branch carries only its own fields, so a switch over it is checked by the compiler. For an
// inherited page, `outcome.page.source.definedIn` names the version that actually wrote the file.
```

See [Writing an adapter](https://hebus.github.io/docs-overlay/docs/adapters/).

## Author the diff

Versions are **top-level folders** under the content root, ordered by semver, with declared non-semver
folders — channels such as `next` — sorted last. There is no `versions.json` to maintain.

```text
content/docs/
  1.0.0/                     the complete tree, frozen for good
    guide/intro.md
    guide/old-api.md
    api/index.md                 overlay: { aliases: api-reference }
  3.0.0/                     differences only
    guide/intro.md               an override — no directive; the file itself is the diff
    guide/new-api.md             overlay: { renamedFrom: guide/old-api }
    guide/legacy.md              overlay: { deleted: true, replacedBy: guide/new-api }
  next/                      work in progress — empty here, so it inherits everything
```

Every directive lives in the YAML frontmatter under a single `overlay:` key, never in a filename, and
always in the version that _introduces_ the change:

| Operation           | How                                                                                                                | What readers get                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| add / change a page | the file itself, no directive                                                                                      | the new content, from that version on                                        |
| rename a page       | `overlay: { renamedFrom: guide/old-api }` on the **new** file                                                      | a permanent redirect from the old slug, inherited forward                    |
| delete a page       | a file at the deleted slug, in the version that removes it: `overlay: { deleted: true, replacedBy: guide/modern }` | an explanation instead of a 404. Add `recursive: true` for the whole subtree |
| re-add a page       | put the file back; there is no special case                                                                        | the page again                                                               |
| alias a page        | `overlay: { aliases: api-reference }` — a string or a list                                                         | a second URL with a canonical. An alias never shadows a page                 |

Priority inside a version is fixed, so "I renamed onto a slug that already exists" has one answer:

```text
own file  >  tombstone  >  rename/redirect  >  alias  >  inherited
```

## Published versions are never touched again

```text
1.0.0 ──────────── the complete tree
        │
        └── 2.0.0 ──── changes only
                         │
                         └── 3.0.0 ──── changes only
```

Because a directive lives in the version that introduces it, a published folder is finished. The
deletion version is derived from the tombstone's own path, so there is no version string to write and
nothing that can drift; cutting `3.0.0` cannot modify `1.0.0`; and the release is auditable with one
command:

```bash
grep -rl 'deleted: true' content/docs/2.0.0/     # exactly what disappears in that release
```

The cost on the other side is worth naming: editing a file in an old version changes what every version
inheriting it serves. `docs-overlay check` lists what a version serves by inheritance, which is worth a
CI job of its own.

## The command line

```text
docs-overlay cut <version>      the channel folder becomes that version   (git mv, so the diff is renames)
docs-overlay check              the engine's diagnostics, with no framework build
docs-overlay prune              drop files a version repeats byte for byte from what it inherits
docs-overlay materialize        write the tree Docusaurus reads           (needs docs-overlay-docusaurus)
```

`cut` and `prune` take `--dry-run`. `check` and `prune` take `--json`, for CI. `materialize --check`
writes nothing and exits non-zero when the generated tree is stale. `materialize` loads the Docusaurus
adapter through a lazy `import()`, so a Fumadocs project that installs the CLI to move a folder never
pulls Docusaurus knowledge in.

> The first invocation is `npx docs-overlay-cli`, **not** `npx docs-overlay`: the latter resolves the
> engine package, which has no bin. Afterwards the `docs-overlay` bin works from package scripts.

Every flag is in the [CLI readme](packages/cli#readme).

## Also in this repository

[`docs-overlay-mermaid`](packages/adapters/mermaid#readme) has nothing to do with versioning. It turns
a Mermaid source into a modern technical SVG **at build time, without a browser** — the gap the
existing options leave, which is either shipping the Mermaid bundle to the reader or driving a headless
Chromium through `rehype-mermaid`.

```bash
npm install docs-overlay-mermaid
```

```ts
import { renderMermaid } from "docs-overlay-mermaid";

const { svg } = await renderMermaid(`
  flowchart LR
    Developer --> Angular
    Angular --> API
    API --> PostgreSQL
    API --> Redis
`);
```

`PostgreSQL` comes out drawn as a database and `Redis` as a cache, with nothing annotated: between the
parser and the renderer sits a semantic model, and that is what a theme draws. No JavaScript reaches
the reader, no request is made during the build, and the same input always produces the same bytes.

It **does not depend on `docs-overlay`** and knows nothing about versioned documentation — it lives
here to share the build, the release and the test suite. Its
[readme](packages/adapters/mermaid#readme) states the Mermaid subset it covers, which is deliberately
smaller than all of Mermaid.

## Where this pays off

**A library with a supported-version policy.** Readers need the documentation that matches the version
they installed, so `1.x`, `2.x` and `3.x` all have to stay online. Three lines may be all that changed
between two of them — and with snapshots, saying so costs three full trees that then drift apart.

**A monorepo publishing several packages.** Each product releases on its own schedule, so one version
list cannot describe them all. The Fumadocs adapter's `scope` option gives each documentation its own
versions inside one site, one page tree and one search index — see
[Several documentations](https://hebus.github.io/docs-overlay/docs/multiple-products/) and
[`examples/fumadocs-multi`](examples/fumadocs-multi).

**A design system.** A component page changes once per breaking release and is stable in between.
Duplicating it every release is what lets the copies diverge.

**An SDK across languages or platforms.** The conceptual pages are shared; only the reference pages
fork per version.

## Why not duplicate your docs?

Snapshots are not wrong, they are just expensive in ways that only show up later:

| With a full copy per version                  | What it costs                                                                                                                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fix a typo present in four versions           | four edits, or the typo survives in three of them                                                                                                                                                                    |
| review a release                              | a diff of ~200 files in which ~190 are identical                                                                                                                                                                     |
| answer "what changed for readers in 11.14.0?" | nobody can, from git alone                                                                                                                                                                                           |
| mark new and updated pages in the sidebar     | hand-maintained, so it decays. Measured on one real 216-page version: **8 badges outright wrong, 65 missing, 96 right** — and the base version, which has no predecessor to be new against, claimed 6 pages were new |
| keep an old URL alive after a rename          | a redirect plugin, configured by hand, per version                                                                                                                                                                   |

And what it costs you instead, because this is not free either:

- Resolution is a concept your contributors have to learn.
- Inheritance is invisible to readers unless the site says so — the adapters expose `inheritedFrom` for
  exactly that, but you have to render it.
- On Docusaurus, `docs/` becomes a build artefact, which is a change of reflex for every contributor.
- Deduplication itself is a modest win. On the measured corpus 119 of ~160 shared files genuinely
  differed between two adjacent versions; the payoff is the cut, the reviewability and the absence of
  drift, not the file count.

## How this is verified

- **606 tests across 42 files** (Vitest). The core's fixtures are TypeScript factories, never files on
  disk — it is filesystem-free and its tests stay that way. The CLI, which is the only package that
  writes anything, is tested against a real tree on a real disk.
- **Three end-to-end suites assert the exported HTML** of three built sites, one per framework path:
  [`examples/fumadocs-next`](examples/fumadocs-next) covers multi-hop inheritance, a tombstone with
  `replacedBy`, a re-add, a rename redirect that still works in the newest release, navigation
  inheritance, an alias with its canonical, and the "Unchanged since" notice — including its absence on
  a version that owns the page. [`examples/fumadocs-multi`](examples/fumadocs-multi) covers several
  documentations side by side. [`examples/docusaurus-classic`](examples/docusaurus-classic) is a real
  Docusaurus build with `onBrokenLinks: "throw"`, which is the only thing that proves Docusaurus
  _accepts_ the tree the adapter plans — including that every generated sidebar is valid for its own
  version.
- **One integration test runs the real `loader()`** from `fumadocs-core`, because the contract that
  matters is the one Fumadocs implements.
- **The core's independence is proven three ways:** a static architecture test that forbids `react`,
  `next`, `fumadocs-*`, `astro`, `nextra`, `vitepress` and every `node:*` import and requires
  `dependencies` _and_ `peerDependencies` to be empty; the same treatment for the Docusaurus adapter's
  "performs no I/O"; and `npm run verify:independence`, which packs the core with `npm pack` and runs a
  probe against it in a temporary directory with **no `node_modules` at all**.
- **`docs-overlay-mermaid` proves it needs no browser the same way:** a static test forbids every
  framework and `node:*` import, pins its two dependencies exactly, and refuses any occurrence of
  `window`, `document`, `HTMLElement`, `customElements`, `navigator` or `localStorage` in the shipped
  sources — a DOM dependency there would mean the package no longer renders at build time, which is the
  only reason it exists. Its layout is asserted deterministic, because every snapshot depends on it.
- `npm run typecheck:packaged` typechecks the adapters against the **built** `.d.ts` with no source
  alias in play, which is what validates the published `exports` maps.
- A performance guard: 10 versions × 500 pages fold in under a second, and 10 000 `resolve()` calls
  trigger no additional fold.

## This project documents itself with it

The site at **[hebus.github.io/docs-overlay](https://hebus.github.io/docs-overlay)** is served by
`docs-overlay`, so it is its own proof.
Its pages live in [`apps/docs/content/docs/`](apps/docs/content/docs): the oldest folder holds the
complete tree, the newer one holds only the pages an actual release rewrote, `next/` holds only what an
unreleased change touched — often nothing — and every inherited page says which version wrote it.
`scripts/cut-docs.mjs` performs the cut inside the "chore: version packages" pull request, so it is
reviewed alongside the version bump rather than remembered afterwards.

## Documentation

| Page                                                                                      | About                                                       |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [Overview](https://hebus.github.io/docs-overlay/docs/)                                    | What it is, what to install                                 |
| [Authoring](https://hebus.github.io/docs-overlay/docs/authoring/)                         | Folders, the operations, releases, maintenance branches     |
| [Resolution](https://hebus.github.io/docs-overlay/docs/resolution/)                       | The fold, the priority order, the truth table               |
| [Architecture](https://hebus.github.io/docs-overlay/docs/architecture/)                   | The core/adapter boundary, and how it is kept honest        |
| [Writing an adapter](https://hebus.github.io/docs-overlay/docs/adapters/)                 | What the engine gives you, and what breaks a site quietly   |
| [Staying on Docusaurus](https://hebus.github.io/docs-overlay/docs/staying-on-docusaurus/) | Keep Docusaurus, drop the snapshots                         |
| [Migrating to Fumadocs](https://hebus.github.io/docs-overlay/docs/migrating-to-fumadocs/) | Two frameworks, one content model, and the honest payoff    |
| [Several documentations](https://hebus.github.io/docs-overlay/docs/multiple-products/)    | One site, one product per scope, each with its own versions |

## Contributing

The one rule is that adapters depend on the core and never the reverse — the core must never import a
framework or a Node built-in, and two guards fail the build if that slips. Setup, the checks to run
before committing, changesets and the release process are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[MIT](LICENSE)
