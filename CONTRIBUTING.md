# Contributing

```bash
npm ci
npm test
```

## The one rule

`@docs-overlay/core` must never import a framework or a Node built-in. Adapters depend on the core;
the core depends on nothing. Before adding a feature, ask whether it belongs to versioned documentation
itself or to a documentation framework — if the latter, it goes in an adapter.

Two guards fail the build if this slips: `packages/core/test/architecture.test.ts` and the
`no-restricted-imports` override in `.oxlintrc.json`. TypeScript will not catch it on its own, because
npm hoists the adapter's dependencies where the core can resolve them.

See [`apps/docs/content/docs/next/architecture.md`](apps/docs/content/docs/next/architecture.md).

## Before committing

```bash
npm run lint
npm run fmt:check
npm run typecheck
npm test
```

And for anything touching the published surface:

```bash
npm run build
npm run typecheck:packaged     # validates the exports maps
npm run verify:independence    # runs the core with no node_modules
npm run build:example          # end-to-end assertions on the exported HTML
npm run build:docs             # the documentation site
```

## Releasing

CI never publishes. It only keeps the "chore: version packages" pull request up to date; merging
that bumps the versions and writes the changelogs. Publishing is `npm run release`, run locally,
which builds, re-checks the packaged types and the core's independence, publishes to npmjs and
pushes one tag per package. It is idempotent, so an interrupted release can just be run again.

## Changesets

Any change to `packages/core/src` or `packages/adapters/*/src` needs one, or `changeset-check` blocks
the pull request. `npx changeset` is interactive; writing the file by hand is fine:

```md
---
"@docs-overlay/core": minor
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
