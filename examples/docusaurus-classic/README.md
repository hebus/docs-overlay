# A Docusaurus site whose versions are an overlay

Two releases and a channel, on a real Docusaurus site. `1.0.0/` holds the complete tree; `2.0.0/`
holds **three files**; `next/` holds nothing at all and still serves every page.

This example exists to answer the one question the adapter's unit tests cannot: **does Docusaurus
accept the tree?** It builds with `onBrokenLinks: "throw"`, every generated sidebar is valid for its own
version, and 35 assertions run against the exported HTML.

## Run it

From the **repository root**, because the example consumes the workspace packages through `file:` links
and needs their `dist/`:

```bash
npm ci
npm run build                                     # the four packages

cd examples/docusaurus-classic
npm ci                                            # its own lockfile — see below
npm start                                         # or `npm run build && npm run serve`
```

`prestart` and `prebuild` run `docs-overlay materialize` for you.

## Why this one has its own lockfile

It is **excluded from the workspaces** (`"!examples/docusaurus-classic"` in the root `package.json`).
Docusaurus pulls `react-router@5`; npm would hoist it to the repository root, and `fumadocs-core` would
then be unable to resolve its own — `npm install` fails with `ERESOLVE` across the whole repository, and
`--legacy-peer-deps` would hide a real incompatibility rather than fix it. Two frameworks whose
transitive trees do not belong in one hoisted `node_modules`.

The side benefit is that `file:` links exercise the packages' published `exports` maps the way a real
consumer does, rather than through a source alias.

> One thing to know if you copy this setup: `docs-overlay-cli` depends on `docs-overlay@^0.2.0`, so npm
> is free to satisfy that from the registry instead of the `file:` link the moment the local version
> leaves that range — and the example would go on passing while testing a _published_ package.
> `scripts/assert-output.mjs` asserts all three packages resolve into `packages/`, which is what keeps
> that from happening quietly.

## What is authored, and what is generated

```text
SOURCE — committed                      GENERATED — gitignored
content/docs/                           versions.json
  1.0.0/   6 files, the complete tree    versioned_docs/version-1.0.0/    6 files
  2.0.0/   3 files, only the diff        versioned_docs/version-2.0.0/    7 files
  next/    empty                         versioned_sidebars/version-*-sidebars.json
                                        .docs-overlay/current/           the channel
                                        .docs-overlay/manifest.json
```

**9 authored files become 13 generated ones**, and that ratio is the whole point — it grows with every
release, because a snapshot copies the tree while an overlay does not.

`docs/`, `versioned_docs/`, `versioned_sidebars/`, `versions.json` and `.docs-overlay/` are **build
output**. You edit `content/docs/`. Every entry in `.gitignore` is anchored with a leading slash: an
unanchored `docs/` would also match `content/docs/` and hide every source file in this example.

`npm run verify` — that is `docs-overlay materialize --check` — exits non-zero when the generated tree
does not match the sources. It is what turns "I edited `docs/` out of habit" into a failed build instead
of an edit that vanishes at the next build without a trace.

## What the content exercises

| In `2.0.0/`                | Directive                                    | What a reader gets                                                                         |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `guide/getting-started.md` | none — the file itself is the diff           | the new text at `/guide/getting-started`, while `/1.0.0/…` still serves the old            |
| `guide/new-api.md`         | `renamedFrom: guide/old-api`                 | `/guide/old-api` redirects here permanently, and stays a route rather than a 404           |
| `guide/legacy.md`          | `deleted: true`, `replacedBy: guide/new-api` | `/guide/legacy` says which version removed it, what replaced it, and where it last existed |

And in `1.0.0/`, `api/reference.md` carries `aliases: api`, so `/api` serves the page with
`api/reference` named as its canonical.

Everything else — `intro.md`, `api/reference.md` — exists in **one** file and is served by all three
versions.

## What the assertions pin

`postbuild` runs `scripts/assert-output.mjs` against `build/`. Beyond the operations above:

- **every doc id in each generated sidebar resolves to a file in that version.** This is the mistake
  that fails a Docusaurus build outright, with `These sidebar document ids do not exist`, and it is what
  you get by applying one shared `sidebars.js` to every version.
- **an inherited sidebar adapts to the version reading it.** `1.0.0`'s sidebar names `guide/old-api`;
  `2.0.0`'s follows the rename to `guide/new-api` and drops the page the tombstone removed. Nobody
  maintains a second sidebar.
- **`versions.json` lists released versions newest first, and never the channel.**
- **a page reaches the generated tree byte for byte** — pages are copied, never re-emitted, so what
  ships is what was authored, line endings included.

## Two warnings, and they are correct

`materialize` reports that `2.0.0` and `next` have a sidebar naming `guide/legacy`, which they no longer
serve. That is the tombstone working: the page is gone, so the entry is pruned from the inherited sidebar
rather than left to break the build. They are warnings rather than errors because the site is coherent
either way — and there really are two, one per version that inherits that sidebar.

## Things a real build taught us

All three cost a failed build to discover, and all three are why `docusaurus.config.js` looks the way it
does:

- **`import.meta` cannot appear anywhere in a Docusaurus config**, not even in a branch that never runs.
  Docusaurus loads configs through jiti, which transpiles them to CJS and evaluates them with
  `vm.Script`, so it is a `SyntaxError` at compile time. This config is CommonJS and uses `__dirname`,
  which jiti provides.
- **`require` is not in scope in an ESM config imported by another config.** One CJS file avoids the
  question entirely.
- **Generated links carry no `baseUrl`.** They resolve it with `useBaseUrl` at build time, so one
  materialisation serves every deployment target and `materialize --check` does not depend on which
  target ran last. `BASE_URL` is an environment variable here for that reason.

Under Git Bash, MSYS rewrites arguments that look like absolute POSIX paths, so
`--route-base-path /` would reach the process as `C:/Program Files/Git/`. The command refuses such a
value rather than poisoning every generated link with it. Running it from a package script — which is
where it belongs — avoids the conversion entirely.

## Read next

- [Versioning Docusaurus documentation without snapshots](https://hebus.github.io/docs-overlay/docs/staying-on-docusaurus/) —
  the walkthrough, including how to move existing snapshots into an overlay.
- [`docs-overlay-cli`](../../packages/cli) — every flag of the four commands.
- [`examples/fumadocs-next`](../fumadocs-next) — the same content model on Fumadocs, where no
  materialisation is needed at all.
