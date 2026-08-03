---
title: Migrating from Docusaurus
description: Folder mapping, steps, and an honest look at the payoff.
---

Docusaurus stores each version as a full snapshot: `versioned_docs/version-11.14.0/` next to
`versioned_docs/version-11.13.0/`, plus `versions.json` and one `versioned_sidebars/*.json` per
version. Cutting a release copies the whole tree.

## The shape of the move

| Docusaurus                                   | docs-overlay                                 |
| -------------------------------------------- | -------------------------------------------- |
| `docs/` (current)                            | `content/docs/next/`                         |
| `versioned_docs/version-11.14.0/`            | `content/docs/11.14.0/`                      |
| `versions.json`                              | nothing — the folders _are_ the list         |
| `versioned_sidebars/version-X-sidebars.json` | `content/docs/X/**/meta.json`, inherited     |
| `lastVersion: "11.14.0"`                     | `latestAtRoot: true`                         |
| `versions: { current: { path: "next" } }`    | `channels: ["next"]`                         |
| `docsVersionDropdown`                        | `versionTabs()` plus a component of your own |

URLs come out identical, which is the point: `/atomic/intro` for the last release, `/next/...` for the
current one, `/11.13.0/...` for an older one. Nothing that was linked externally breaks.

## Steps

1. **Rename the folders.** `version-11.13.0` → `11.13.0`, and `docs/` → `next/`. Keep the `meta.json`
   files; drop `versions.json` and `versioned_sidebars/`.

2. **Widen the schema.** Without this nothing works and nothing says so:

   ```ts
   // source.config.ts
   import { withOverlay } from "@docs-overlay/fumadocs/schema";
   export const docs = defineDocs({ dir: "content/docs", docs: { schema: withOverlay(pageSchema) } });
   ```

3. **Wire the loader** — see the [README](../README.md#fumadocs-usage).

4. **Prune what is identical.** Any file in an older version byte-identical to the one it would inherit
   can be deleted; the overlay serves the inherited copy. On the tree this was built for, 43 of 188
   files were identical between two adjacent versions.

5. **Convert the deletions.** A page present in an old snapshot but absent from the newer one already
   behaves correctly — it simply is not in the newer folder. A page you want _removed_ from a newer
   version while the file still exists needs a tombstone in that version.

6. **Convert the renames.** Add `renamedFrom` to the new file in the version that renamed it. Docusaurus
   had no equivalent, so this is new capability rather than a translation.

## Be honest about the payoff

On the corpus this was measured against, 115 of ~170 shared files genuinely differ between 11.13.0 and
11.14.0. Deduplication is therefore a modest win. What actually changes:

- **Cutting a version costs nothing.** `git mv next 11.15.0 && mkdir next` is a zero-byte content diff
  against ~190 copied files and a ~1.2 MB commit.
- **Navigation stops being duplicated.** The two `versioned_sidebars` files measured differed by a
  single line across 4 kB.
- **Deletions and renames become declarative** and reviewable, instead of manual surgery inside frozen
  folders — and a renamed page keeps its old URL working, which it did not before.

## What is not supported

Versioned i18n. Fumadocs' `i18n.parser: "dir"` consumes the first path segment, which is the one the
version occupies. `0.x` does not combine the two.
