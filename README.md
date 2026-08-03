# docs-overlay

Versioned documentation where you author only the **diff** between versions.

The oldest version folder holds the complete tree. Every newer version contains only what
actually changed — an override, a new page, a rename, or a tombstone. Everything else is
inherited. Cutting a release becomes:

```bash
git mv content/docs/next content/docs/11.15.0 && mkdir content/docs/next
```

That is a **zero-byte content diff** (git detects the renames), against ~190 copied files for a
snapshot-based versioning tool.

## Packages

| Package                                               | Role                                                                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`docs-overlay`](packages/core)                       | The engine. Versions, pages, slugs, metadata, inheritance, resolution. Zero dependencies, no Node built-ins, no framework. |
| [`docs-overlay-fumadocs`](packages/adapters/fumadocs) | Fumadocs / Next.js adapter.                                                                                                |

Adapters depend on the core, never the reverse. Adding support for another framework means
writing an adapter — it must never require a change to the core.

## Authoring convention

Versions are **top-level folders** under the content root. There is no `versions.json` to
maintain: the list of versions _is_ the list of folders, ordered by semver, with declared
non-semver folders (`next`) sorted last.

```
content/docs/
  1.0.0/                     complete tree, frozen
    guide/intro.md
    guide/old-api.md
  3.0.0/                     differences only
    guide/intro.md               override
    guide/new-api.md             overlay: { renamedFrom: guide/old-api }
    guide/legacy.md              overlay: { deleted: true, replacedBy: guide/new-api }
  next/                      work in progress
```

Resolution order for `next` is `next → 3.0.0 → 1.0.0`. All four editing operations are expressed
**in the version that introduces them**, so a published version folder is never touched again:

| Operation     | How                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| add a page    | the new file                                                                                                    |
| change a page | the new file                                                                                                    |
| rename a page | `overlay: { renamedFrom: "guide/old-api" }` on the new file                                                     |
| delete a page | a **tombstone**: a file at the same path, in the version that removes it, carrying `overlay: { deleted: true }` |

The deletion version is derived from the tombstone's own path, so there is no version string to
write and nothing that can drift. `grep -rl 'deleted: true' content/docs/3.0.0/` lists exactly
what disappears in that release.

## Fumadocs usage

> [!IMPORTANT]
> **`pageSchema` is a zod object in `strip` mode**, so an `overlay:` key in frontmatter is
> silently dropped before it reaches `page.data`. You must widen the schema with `withOverlay()`.
> Skip this and everything appears to work — except that no directive has any effect, with no
> error to explain why.

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
  // `/docs/...` is the newest release, `/docs/11.13.0/...` an older one.
  latestAtRoot: true,
  labels: { next: "Next 🚧" }
});

export const source = loader({
  baseUrl: "/docs",
  source: overlay.source,
  url: overlay.url
});
```

```tsx
// app/docs/[[...slug]]/page.tsx
import { resolveRoute, staticParams } from "docs-overlay-fumadocs";
import { overlay, source } from "@/lib/source";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const route = resolveRoute(overlay, (await props.params).slug);

  if (route.kind === "not-found") notFound();
  if (route.kind === "redirect") return <Redirecting to={route.to} />;
  if (route.kind === "gone") return <Removed {...route} />;

  const page = source.getPage(route.slugs);
  // ...render as usual
}

export function generateStaticParams() {
  // Not `source.generateParams()`: that knows only pages, and it keeps the version segment even
  // where the URL drops it. `staticParams()` also covers aliases, old slugs and removed pages.
  return staticParams(overlay);
}
```

The version is the first slug segment, so one `loader()` serves every version: the page tree, the
search index and `generateParams()` all stay coherent, and a relative link such as `./b.md` resolves
inside the version it was written in.

## Development

```bash
npm ci
npm run build                # both packages: vite (esm) + tsc (d.ts)
npm test                     # vitest, core + adapter
npm run lint                 # oxlint
npm run fmt:check            # oxfmt
npm run typecheck            # per package, against core sources
npm run typecheck:packaged   # adapter against the BUILT core d.ts — validates `exports`
npm run verify:independence  # packs the core and runs it with no node_modules at all
npm run build:example        # the example site, plus its end-to-end assertions
npm run build:docs           # the documentation site
```

## Releasing

Changesets accumulate on `main`, and the `release-pr` workflow keeps a
"chore: version packages" pull request up to date. Merging it bumps the versions and writes the
changelogs.

Publishing is then done **locally**, so the tarball that reaches npmjs is the one verified on a real
machine and no long-lived npm token has to live in CI:

```bash
npm run release
```

It refuses a dirty tree **and** a `HEAD` that did not introduce the version — so what reaches npm is
always the tree the changelog describes. Beyond that it skips any version already on npmjs, re-runs the
packaging and independence checks before publishing, and pushes one git tag per package. Running it
twice is harmless; `npm run release:dry` runs every check and publishes nothing.

Every change to a published package needs a changeset (`npx changeset`, or write
`.changeset/<name>.md` by hand); the `changeset-check` workflow blocks the PR otherwise. Put
`#skip-changeset` in the PR title for docs- or CI-only changes.

## Documentation

**https://hebus.github.io/docs-overlay** — and that site is documented with this library, so it is its own proof.

| Page                                                                                              | About                                                        |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Authoring](https://hebus.github.io/docs-overlay/docs/authoring/)                                 | Folders, the four operations, releases, maintenance branches |
| [Resolution](https://hebus.github.io/docs-overlay/docs/resolution/)                               | The fold, the priority order, the truth table                |
| [Architecture](https://hebus.github.io/docs-overlay/docs/architecture/)                           | The core/adapter boundary and how it is kept honest          |
| [Writing an adapter](https://hebus.github.io/docs-overlay/docs/adapters/)                         | What the engine gives you, and what breaks a site quietly    |
| [Migrating from Docusaurus](https://hebus.github.io/docs-overlay/docs/migrating-from-docusaurus/) | Folder mapping, steps, honest payoff                         |

The pages live in [`apps/docs/content/docs/`](apps/docs/content/docs) — `0.1.0/` holds all of them and
`next/` is an empty folder that inherits every one. Cutting that version was
`git mv next 0.1.0 && mkdir next`, which git recorded as seven renames and nothing else.

[`examples/fumadocs-next`](examples/fumadocs-next) is a working site with five versions covering
override, rename, tombstone, re-add, alias and navigation inheritance. Its `postbuild` asserts the
exported HTML, so it is the end-to-end test as much as the demo.

## Licence

MIT
