# Architecture

```
@docs-overlay/fumadocs        (adapter)
            |
            v
     @docs-overlay/core       (engine)
```

The dependency direction is one-way and enforced by tests, not by convention. Adding support for
another framework means writing an adapter; it must never require a change to the core.

## What belongs where

The question to ask before adding anything: _is this part of versioned documentation itself, or part
of a documentation framework?_

| Core                                   | Adapter                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| versions, ordering, inheritance chains | URLs, `baseUrl`, `basePath`, trailing slashes             |
| pages, slugs, resolution               | page trees, sidebars, tabs                                |
| aliases, redirects as **slug → slug**  | HTTP status codes, `next.config` redirects                |
| tombstones and their metadata          | React components, layouts                                 |
| metadata as an **opaque payload**      | the meaning of `pages: []`, `"..."`, `"!x"`, `root: true` |
| caching, dependency graph              | search indexing and filtering                             |
| —                                      | filesystem access, MDX compilation                        |

## The rules the core lives by

**Zero runtime dependencies, no Node built-ins.** `@docs-overlay/core` runs in a browser, a worker or
an edge runtime. The semver comparator is sixty hand-written lines rather than a dependency.

**Synchronous.** A Fumadocs `StaticSource` is already a materialised array, and making the core async
would spread `await` across resolution, caching and the graph for no gain. A future filesystem source
resolves its I/O before constructing entries.

**Metadata is opaque.** `ResolvedPage.meta` is a generic the core never inspects, and directives are
read through an injected `readDirectives`. This is what keeps compiled MDX, `structuredData` and
Fumadocs' navigation grammar out of the package.

**It never throws on bad content.** Problems become `Diagnostic`s. A broken page must not take down a
dev server; whether an `error` diagnostic should fail a build is the caller's decision.

**Metadata is inherited whole, never merged.** Understanding what is inside a `meta.json` is an
adapter's job — the core only ever applies inheritance to it, per directory. Merging is delegated
through a `MetaMerger` the adapter supplies.

## The guards

Two things fail the build if the rule is broken:

- `packages/core/test/architecture.test.ts` — asserts the manifest declares no dependency, and scans
  every shipped source file for a forbidden import. It lives outside `src/` because it needs
  `node:fs`, which is exactly what it forbids there.
- `.oxlintrc.json` — a `no-restricted-imports` override scoped to `packages/core/src/**`.

Plus `npm run verify:independence`, which packs the core, unpacks it into a directory with no
`node_modules` at all, and runs it there. TypeScript alone would not catch a stray `fumadocs-core`
import in this monorepo, because npm hoists it and the compiler resolves it happily — that is
precisely why the text scan and the sandbox exist.

## Adapter contract

An adapter consumes `DocumentationSource`, the deliberately small stable interface:

```ts
interface DocumentationSource<M = unknown> {
  getVersions(): readonly Version[];
  getPages(version: VersionId): readonly ResolvedPage<M>[];
  getPage(version: VersionId, slug: Slug | SlugKey): ResolvedPage<M> | undefined;
}
```

`Overlay` extends it with resolution, metadata, redirects, the dependency graph and invalidation. See
[adapters.md](adapters.md).
