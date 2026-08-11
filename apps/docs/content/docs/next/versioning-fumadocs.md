---
title: Versioning a Fumadocs site
description: Add versioned documentation to a Fumadocs site without copying it — the files to change, the URLs you get, and the four things that fail silently.
---

Fumadocs has no version model of its own. The usual answer is a folder per version and a full copy of
the tree per release, after which a typo present in four versions takes four edits and nobody can see
from git what changed for readers between two releases.

This is the other way: one folder per version, holding **only what that version changed**. Everything
else is inherited.

Start to finish this is one install and about thirty lines across three files you already have.

## What you end up with

| URL                       | Serves                                                       |
| ------------------------- | ------------------------------------------------------------ |
| `/docs/guide/setup`       | the newest release, whichever version actually owns the file |
| `/docs/1.0.0/guide/setup` | that release specifically                                    |
| `/docs/next/guide/setup`  | the unreleased channel                                       |

One `loader()` serves all of them, so the page tree, the search index and `generateParams()` stay
coherent, and a relative link such as `./b.md` keeps resolving inside the version it was written in.

## 1. Move what you have into a version folder

This is the step no configuration can do for you, and the one people get stuck on. Your existing
`content/docs/` becomes the first version, and an empty channel goes next to it:

```bash
git mv content/docs content/docs-tmp
mkdir content/docs
git mv content/docs-tmp content/docs/1.0.0
mkdir content/docs/next && touch content/docs/next/.gitkeep
```

Nothing else moves. `content/docs/next/` is empty, and an empty channel inherits the whole tree — so
before you have written a single diff, the site already serves every page at both `/docs/…` and
`/docs/next/…`.

```bash
npm install docs-overlay docs-overlay-fumadocs
```

## 2. Widen the frontmatter schema

`pageSchema` is a zod object in `strip` mode, so an `overlay:` key is **silently dropped** before it
reaches `page.data`. This is the one failure that looks like success: everything builds, and no
directive has any effect.

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

## 3. Wire the loader

```ts
// lib/source.ts
import { loader } from "fumadocs-core/source";
import { docs } from "collections/server";
import { overlaySource } from "docs-overlay-fumadocs";

export const overlay = overlaySource({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
  channels: ["next"],
  latestAtRoot: true,
  labels: { next: "Unreleased" }
});

export const source = loader({ baseUrl: "/docs", source: overlay.source, url: overlay.url });
```

`channels` names the folders that are not version numbers; they sort last and are never `latest`.
`latestAtRoot` is what keeps `/docs/guide/setup` pointing at the newest release, so cutting a version
breaks no external link. `labels` is display only.

## 4. Route every slug, not just pages

A version does not only answer for its pages. It also answers for aliases, for slugs a rename left
behind, and for pages a tombstone removed — and each of those wants a different response.

```tsx
// app/docs/[[...slug]]/page.tsx
import { notFound } from "next/navigation";
import { resolveRoute, staticParams } from "docs-overlay-fumadocs";
import { overlay, source } from "@/lib/source";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await props.params;
  const route = resolveRoute(overlay, slug);

  if (route.kind === "not-found") notFound();
  if (route.kind === "redirect") return <Moved to={route.to} />;
  if (route.kind === "gone") return <Removed {...route} />;

  const page = source.getPage(route.slugs);
  if (page === undefined) notFound();
  // …render as an unversioned site would
}

export function generateStaticParams() {
  return staticParams(overlay);
}
```

`Moved` and `Removed` are yours to write — this package renders nothing. The complete file, with both
of them filled in, is
[`examples/fumadocs-next/app/docs/[[...slug]]/page.tsx`](https://github.com/hebus/docs-overlay/blob/main/examples/fumadocs-next/app/docs/%5B%5B...slug%5D%5D/page.tsx).

> **`generateStaticParams()` must use `staticParams(overlay)`, not `source.generateParams()`.** The
> loader knows only pages, so an alias, an old slug or a removed page would get no HTML — and on a
> static host that is a 404 instead of the redirect or the explanation the resolver was ready to give.
> With `latestAtRoot`, params built from slugs would also keep a version segment the URLs drop, and
> every one of those links would 404.

On a static export, a `redirect` has to be **rendered** as a page with a `meta refresh` and a
canonical: `next.config` redirects are ignored by `output: "export"`.

## 5. Say when a page is inherited

Inheritance is invisible by default. `/docs/guide/setup` and `/docs/next/guide/setup` render the same
file, and nothing on the page says which version wrote it. A `page` resolution carries
`inheritedFrom: { version, hops }` whenever the browsing version does not own the file, and nothing at
all when it does — so `if (route.inheritedFrom)` is the whole test.

```tsx
{route.inheritedFrom === undefined ? null : <p>Unchanged since {route.inheritedFrom.version}</p>}
```

Do not link to that version: it serves the very same file, so the link returns identical prose and costs
the reader their place. More on the reasoning in [Resolution](./resolution.md).

## 6. Fail the build on a content problem

Nothing throws for bad content — problems come back as diagnostics, and you decide the bar. Add
`findOrphanPages()`, which catches a page that is routed but that no sidebar reaches:

```ts
// lib/source.ts
import { findOrphanPages } from "docs-overlay-fumadocs";

export function reportDiagnostics(): void {
  const problems = [...overlay.diagnostics, ...findOrphanPages(source)];
  for (const problem of problems) console.log(`[docs-overlay] ${problem.severity}: ${problem.code} — ${problem.message}`);

  const errors = problems.filter(problem => problem.severity === "error");
  if (errors.length > 0) throw new Error(`${errors.length} content error(s); see the log above.`);
}
```

Call it once, from the docs layout. `docs-overlay check` runs the same engine diagnostics from the
command line, in seconds and without a framework build — see [The command line](./cli.md).

## 7. Tag the search index by version

A page served by five versions produces five index entries pointing at the same `structuredData`, so an
unfiltered query returns five copies of most results — which, on a site whose premise is inheritance, is
nearly every result.

```ts
// app/api/search/route.ts
import { createFromSource } from "fumadocs-core/search/server";
import { versionTagOf } from "docs-overlay-fumadocs";
import { source } from "@/lib/source";

export const { staticGET: GET } = createFromSource(source, {
  buildIndex: page => ({
    id: page.url,
    url: page.url,
    title: page.data.title,
    description: page.data.description,
    structuredData: page.data.structuredData,
    tag: versionTagOf(page)
  })
});
```

Use `staticGET` on a static export: the usual `GET` handler answers one query at a time and needs a
server at request time, so on GitHub Pages it 404s and the dialog reports "no results" rather than an
error.

## Then what

You now have a versioned site with one version in it. From here:

- [Authoring](./authoring.md) — the operations, and how to cut a release.
- [The command line](./cli.md) — `cut`, `check`, `prune`.
- [Several documentations](./multiple-products.md) — a monorepo whose packages release separately.
- [`examples/fumadocs-next`](https://github.com/hebus/docs-overlay/tree/main/examples/fumadocs-next) —
  five versions exercising override, rename, tombstone, re-add, alias and navigation inheritance, with
  end-to-end assertions on the exported HTML.

**Not supported in `0.x`:** i18n on top of versions. Fumadocs' `i18n.parser: "dir"` consumes the first
path segment, which is the one the version uses.
