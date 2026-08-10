---
title: docs-overlay
description: Versioned documentation where you author only the diff between versions.
---

The oldest version folder holds the complete tree. Every newer version contains only what actually
changed — an override, a new page, a rename, or a tombstone. Everything else is inherited.

Cutting a release becomes:

```bash
docs-overlay cut 5.0.0
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

| Package                   | Role                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `docs-overlay`            | The engine. Versions, pages, slugs, metadata, inheritance, resolution. Zero dependencies, no Node built-ins, no framework. |
| `docs-overlay-fumadocs`   | Fumadocs / Next.js adapter.                                                                                                |
| `docs-overlay-docusaurus` | Docusaurus adapter. Plans the tree Docusaurus insists on reading from disk.                                                |
| `docs-overlay-cli`        | The one command line: `cut`, `check`, `prune`, `materialize`.                                                              |

Adapters depend on the core, never the reverse. Neither adapter touches the filesystem — the Fumadocs one
because the framework does the reading, the Docusaurus one because the CLI does the writing.

## Guides

| If you want to…                                | Read                                                 |
| ---------------------------------------------- | ---------------------------------------------------- |
| keep Docusaurus and stop maintaining snapshots | [Staying on Docusaurus](./staying-on-docusaurus.md)  |
| leave Docusaurus for Fumadocs                  | [Migrating to Fumadocs](./migrating-to-fumadocs.md)  |
| start from nothing                             | [Authoring](./authoring.md), after the install below |

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

On Docusaurus the install is different — the adapter performs no I/O and a command writes the tree. See
[Staying on Docusaurus](./staying-on-docusaurus.md).

Start with [Authoring](./authoring.md).
