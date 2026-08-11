# Contributing

```bash
npm ci
npm test
```

## The one rule

`docs-overlay` must never import a framework or a Node built-in. Adapters depend on the core;
the core depends on nothing. Before adding a feature, ask whether it belongs to versioned documentation
itself or to a documentation framework — if the latter, it goes in an adapter.

Two guards fail the build if this slips: `packages/core/test/architecture.test.ts` and the
`no-restricted-imports` override in `.oxlintrc.json`. TypeScript will not catch it on its own, because
npm hoists the adapter's dependencies where the core can resolve them.

See [Architecture](https://hebus.github.io/docs-overlay/docs/architecture/), whose source is
[`apps/docs/content/docs/0.1.0/architecture.md`](apps/docs/content/docs/0.1.0/architecture.md).

## Before committing

```bash
npm run lint                   # oxlint; `npm run lint:fix` for the fixable ones
npm run fmt:check              # oxfmt — it formats Markdown and JSON too, so run `npm run fmt` first
npm run typecheck              # per package, against the core's sources
npm test                       # vitest; `npm run test:watch` while working
```

And for anything touching the published surface:

```bash
npm run build                  # the four packages: vite (esm) + tsc (d.ts)
npm run typecheck:packaged     # validates the exports maps
npm run verify:independence    # runs the core with no node_modules
npm run build:example          # end-to-end assertions on the exported HTML
npm run build:example:multi    # the same, for several documentations on one site
npm run build:docs             # the documentation site
```

And for anything touching the documentation:

```bash
npm run check:journal          # refuses a journal that could have been reconstructed
npm run check:coverage         # refuses documentation that dropped a judgement or a pitfall
```

## Releasing

CI never publishes. It only keeps the "chore: version packages" pull request up to date; merging
that bumps the versions and writes the changelogs. Publishing is local, so the tarball that reaches
npmjs is the one verified on a real machine and no long-lived npm token has to live in CI:

```bash
npm run release:dry    # every check, nothing published
npm run release
```

It builds, re-checks the packaged types and the core's independence, publishes each pending package
to npmjs and pushes one tag per package — `docs-overlay@0.1.0`, since Changesets bumps the four
packages independently and they will drift apart.

Two refusals worth knowing about, because both protect the same thing — that npm, the changelog and
git describe the same tree:

- **a dirty working tree**, since the tag it pushes points at `HEAD`;
- **a package whose own files changed after its version was set**. Release from the version commit, or
  close to it. If features have landed in that package since, cut a new version rather than shipping a
  tree that is ahead of its own changelog. There is deliberately no escape hatch. Note what this
  deliberately allows: touching anything _outside_ the package directories — the lockfile, the
  documentation site — does not block a release, which is what lets the version pull request also cut
  the docs.

Everything else is idempotent: a version already on npmjs is skipped and an existing tag is left
alone, so an interrupted release can simply be run again.

### Cutting the documentation

Nothing to do: `changeset:version` runs `scripts/cut-docs.mjs` inside the version pull request, so the
cut is committed and reviewed with the bump rather than remembered afterwards.

The site documents the engine, so the folder takes **`docs-overlay`'s** version. A release of the
adapter alone therefore cuts nothing — the unreleased pages stay in `next/` until the engine ships — and
the script prints which of the two happened. It is idempotent, because the version commit is rebuilt on
every push to `main`, and it refuses a name the engine would not read as a version rather than creating
a folder that would silently disappear from the site.

## Changesets

Any change to `packages/core/src` or `packages/adapters/*/src` needs one, or `changeset-check` blocks
the pull request. `npx changeset` is interactive; writing the file by hand is fine:

```md
---
"docs-overlay": minor
---

Add `getEntries()` so adapters can enumerate every slug a version answers for.
```

Write the summary in English, in the present tense, oriented at what a consumer can now do — it lands
verbatim in the changelog. One changeset per functional change. Never edit a `version` field yourself.

For a docs- or CI-only change, put `#skip-changeset` in the pull request title.

## Tests

Core fixtures are TypeScript factories, never files on disk — the core is filesystem-free and its tests
stay that way. Adapter tests run against the real `loader()` from `fumadocs-core`, without Next or MDX
compilation, because the contract that matters is the one Fumadocs implements.

When a test encodes a decision rather than a mechanism, say so in a comment. `resolve("4.0.0",
"guide/old")` returning a redirect is a choice about link rot, not an implementation detail, and the
test is there to stop it being reversed by accident.

Both adapters also carry an architecture test, because TypeScript catches neither of their rules: npm
hoists every workspace dependency, so a stray import of a framework — or of `node:fs` in an adapter that
claims to perform no I/O — resolves and compiles here, then breaks in a consumer's project. Keep Node's
ambient types out of an adapter's own `src` project, in a separate test project if the test needs them:
with `process` and `Buffer` in scope, "performs no I/O" becomes a stated intention rather than a checkable
claim.

### The Docusaurus example is not a workspace

`examples/docusaurus-classic` is excluded from `workspaces` and has its own lockfile, and it has to stay
that way. Docusaurus pulls `react-router@5`, npm hoists it to the root, and `fumadocs-core` then cannot
resolve its own: `npm install` fails with `ERESOLVE`, and `--legacy-peer-deps` would hide a real
incompatibility across the whole repository. Two frameworks whose transitive trees do not belong in one
hoisted `node_modules`.

It depends on the packages through `file:` links, which has the side benefit of exercising their
published `exports` maps the way a real consumer does. Because it is outside the workspaces it needs its
own install, and the packages have to be built first:

```bash
npm run build
npm ci      --prefix examples/docusaurus-classic
npm run build --prefix examples/docusaurus-classic
```

Its own workflow, `.github/workflows/docusaurus-example.yml`, runs that on the paths that can affect it,
rather than adding a second framework's dependency tree to every pull request. It is the only thing that
proves Docusaurus _accepts_ the tree the adapter plans — the adapter's unit tests describe that tree, and
a real build with `onBrokenLinks: throw` is what checks it.

One trap worth knowing: `docs-overlay-cli` depends on `docs-overlay@^0.2.0`, so npm may satisfy that from
the registry instead of the `file:` link once the local version leaves that range — and the example would
keep passing while testing a published package. Its `assert-output.mjs` asserts that all three packages
resolve into `packages/`.

## Migration notes

`notes/migrations/<name>/` holds the journal of a real migration: `journal.jsonl` is append-only and is
the source of truth, everything else is projected from it by `npm run render:journal`.

It exists because two deliverables are meant to be **derived** from a migration rather than invented — the
migration command, and the guide for people doing it to their own site. Both need to know which steps a
tool can take unattended and which need a human, and that split has to be recorded at the time; recording
it afterwards is indistinguishable from guessing it.

`npm run check:journal` refuses a journal that could have been reconstructed. `npm run check:coverage`
refuses documentation that stopped mentioning a judgement or a pitfall the journal recorded — those are the
entries that cost the most to rediscover and the easiest to drop. Both run in CI.
