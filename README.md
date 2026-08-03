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

| Package                                                | Role                                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| [`@docs-overlay/core`](packages/core)                  | The engine. Versions, pages, slugs, metadata, inheritance, resolution. Zero dependencies, no Node built-ins, no framework. |
| [`@docs-overlay/fumadocs`](packages/adapters/fumadocs) | Fumadocs / Next.js adapter.                                                                                                |

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
import { withOverlay } from "@docs-overlay/fumadocs/schema";

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
import { overlaySource } from "@docs-overlay/fumadocs";

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
import { resolveRoute, staticParams } from "@docs-overlay/fumadocs";
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
```

Every change to a published package needs a changeset (`npx changeset`, or write
`.changeset/<name>.md` by hand); the `changeset-check` workflow blocks the PR otherwise. Put
`#skip-changeset` in the PR title for docs- or CI-only changes.

## Documentation

- [Architecture](docs/architecture.md) — the core/adapter boundary and how it is enforced
- [Resolution](docs/resolution.md) — the fold, the priority order, the truth table
- [Authoring](docs/authoring.md) — the four operations, releases, maintenance branches
- [Writing an adapter](docs/adapters.md)
- [Migrating from Docusaurus](docs/migrating-from-docusaurus.md)

[`examples/fumadocs-next`](examples/fumadocs-next) is a working site with five versions covering
override, rename, tombstone, re-add, alias and navigation inheritance. Its `postbuild` asserts the
exported HTML, so it is the end-to-end test as much as the demo.

## Licence

MIT
