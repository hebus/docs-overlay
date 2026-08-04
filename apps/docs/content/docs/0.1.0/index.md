---
title: docs-overlay
description: Versioned documentation where you author only the diff between versions.
---

The oldest version folder holds the complete tree. Every newer version contains only what actually
changed — an override, a new page, a rename, or a tombstone. Everything else is inherited.

Cutting a release becomes:

```bash
git mv content/docs/next content/docs/5.0.0 && mkdir content/docs/next
```

Git records that as renames, so the content diff is **zero bytes**, and the emptied channel inherits
everything again.

## This site is its own proof

You are reading documentation served by docs-overlay. The releases and the `next` channel are listed in
the sidebar; switch between them there.

`next/` holds only the pages an unreleased change has rewritten — often none at all. Every other page
it serves is the release's file of the same name, this one included, and carries a notice naming the
version that wrote it. Write the diff, inherit the rest: the whole model fits in a folder you can list.
And `/docs/authoring` keeps pointing at the newest release, so cutting a version breaks no link.

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
