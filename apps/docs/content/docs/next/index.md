---
title: docs-overlay
description: Version your documentation without duplicating it — author only the diff between versions, on Fumadocs or on Docusaurus.
---

The oldest version folder holds the complete tree. Every newer version contains only what actually
changed — an override, a new page, a rename, or a tombstone. Everything else is inherited.

Cutting a release becomes:

```bash
docs-overlay cut 5.0.0
```

Git records that as renames, so the content diff is **zero bytes**, and the emptied channel inherits
everything again.

## Start here

| If you…                                      | Read                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| use Fumadocs                                 | [Versioning a Fumadocs site](./versioning-fumadocs.md)                          |
| use Docusaurus and want to keep it           | [Versioning Docusaurus documentation](./staying-on-docusaurus.md)               |
| want the commands                            | [The command line](./cli.md)                                                    |
| are leaving Docusaurus for Fumadocs          | [Migrating to Fumadocs](./migrating-to-fumadocs.md)                             |
| document one npm package                     | [Versioning documentation for an npm package](./versioning-npm-package-docs.md) |
| publish several packages from one repository | [Versioning documentation in a monorepo](./versioning-in-a-monorepo.md)         |
| use another framework, or none               | [Writing an adapter](./adapters.md)                                             |
| want diagrams rendered at build time         | [Diagrams](./diagrams.md)                                                       |

Then [Authoring](./authoring.md) for the operations, and [Resolution](./resolution.md) for what the
engine answers.

## This site is its own proof

You are reading documentation served by docs-overlay. The releases and the `next` channel are listed in
the sidebar; switch between them there.

`next/` holds only what an unreleased change has written — often nothing at all. Every page it serves
that is not in that list is the release's file of the same name, and it carries a notice naming the
version that wrote it. Write the diff, inherit the rest: the whole model fits in a folder you can list.
And `/docs/authoring` keeps pointing at the newest release, so cutting a version breaks no link.

## Packages

| Package                   | Role                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `docs-overlay`            | The engine. Versions, pages, slugs, metadata, inheritance, resolution. Zero dependencies, no Node built-ins, no framework. |
| `docs-overlay-fumadocs`   | Fumadocs / Next.js adapter. Re-projects a source the framework already read; writes nothing.                               |
| `docs-overlay-docusaurus` | Docusaurus adapter. Plans the snapshot tree Docusaurus insists on reading, so you can stop maintaining it.                 |
| `docs-overlay-cli`        | The one command line: `cut`, `check`, `prune`, `materialize`.                                                              |
| `docs-overlay-mermaid`    | Mermaid to a technical SVG, at build time and without a browser. Depends on none of the above.                             |

Adapters depend on the core, never the reverse. Neither adapter touches the filesystem — the Fumadocs one
because the framework does the reading, the Docusaurus one because the CLI does the writing. Adding
support for another framework means writing an adapter, and must never require a change to the core.

`docs-overlay-mermaid` is the exception to that shape, and deliberately so: it depends on neither the
core nor an adapter, and it knows nothing about versioned documentation. It is published from this
repository to share the build, the release and the test suite — nothing more. See [Diagrams](./diagrams.md).

## Install

```bash
npm install docs-overlay docs-overlay-fumadocs          # Fumadocs
npm install -D docs-overlay docs-overlay-cli docs-overlay-docusaurus   # Docusaurus
```

The three files to change on Fumadocs — and the schema step that fails silently if you skip it — are in
[Versioning a Fumadocs site](./versioning-fumadocs.md). On Docusaurus the shape is different, because
the adapter performs no I/O and a command writes the tree:
[Versioning Docusaurus documentation](./staying-on-docusaurus.md).
