---
title: docs-overlay
description: Versioned documentation where you author only the diff between versions.
---

The oldest version folder holds the complete tree. Every newer version contains only what actually
changed — an override, a new page, a rename, or a tombstone. Everything else is inherited.

Cutting a release becomes:

```bash
git mv content/docs/next content/docs/0.2.0 && mkdir content/docs/next
```

Git records that as renames, so the content diff is **zero bytes**, and the emptied channel inherits
everything again.

## This site is its own proof

You are reading documentation served by docs-overlay. `next/` is the only folder that exists today,
because nothing has been released yet — and the URLs are already clean, because the newest version is
served at the root whether or not it is a release.

When `0.1.0` ships, the command above is all it takes for this site to grow a second version. Every
page nobody touches afterwards will keep being served from the very file you are reading now.

## Packages

| Package                 | Role                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `docs-overlay`          | The engine. Versions, pages, slugs, metadata, inheritance, resolution. Zero dependencies, no Node built-ins, no framework. |
| `docs-overlay-fumadocs` | Fumadocs / Next.js adapter.                                                                                                |

Adapters depend on the core, never the reverse.

## Install

```bash
npm install docs-overlay docs-overlay-fumadocs
```

Then widen your frontmatter schema — this step is not optional, and skipping it fails silently:

```ts
// source.config.ts
import { pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/config";
import { withOverlay } from "docs-overlay-fumadocs/schema";

export const docs = defineDocs({
  dir: "content/docs",
  docs: { schema: withOverlay(pageSchema) }
});
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
  latestAtRoot: true
});

export const source = loader({ baseUrl: "/docs", source: overlay.source, url: overlay.url });
```

Start with [Authoring](./authoring.md).
