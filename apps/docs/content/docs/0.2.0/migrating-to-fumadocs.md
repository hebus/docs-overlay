---
title: Migrating from Docusaurus to Fumadocs
description: Two frameworks, one content model — what changes, what breaks, and the honest payoff.
overlay:
  renamedFrom: migrating-from-docusaurus
---

There are two ways out of Docusaurus' snapshot versioning, and this page is the one where you also change
framework. If you want to **keep Docusaurus**, read [Staying on Docusaurus](./staying-on-docusaurus.md)
instead: the content model is identical, and only the last mile differs.

Docusaurus stores each version as a full snapshot: `versioned_docs/version-11.14.0/` next to
`versioned_docs/version-11.13.0/`, plus `versions.json` and one `versioned_sidebars/*.json` per version.
Cutting a release copies the whole tree.

## The shape of the move

| Docusaurus                                   | docs-overlay + Fumadocs                      |
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

   Use `git mv`, not a copy. It renames the index entry and replays no clean filter, so the blob hashes
   survive — which is what keeps this a rename in review instead of a rewrite. It matters more than it
   sounds: with `text=auto` in `.gitattributes`, git normalises line endings **on add**, and only for paths
   new to the index. A move creates exactly such a path, so copy-then-add rewrites every CRLF file in the
   tree. On the corpus measured for this, that was 174 of 385 files.

2. **Widen the schema.** Without this nothing works and nothing says so:

   ```ts
   // source.config.ts
   import { withOverlay } from "docs-overlay-fumadocs/schema";
   export const docs = defineDocs({ dir: "content/docs", docs: { schema: withOverlay(pageSchema) } });
   ```

3. **Wire the loader** — see [Install](./index.md#install).

4. **Prune what is identical.** Any file in a newer version byte-identical to the one it would inherit can
   be deleted; the overlay serves the inherited copy. `docs-overlay prune` computes the set, and it has to
   be computed rather than recorded: it depends on the branch's own content, so a backport onto another
   branch has a different answer.

   Compare **raw bytes**, not normalised text. A difference that is only a line ending is still a
   difference, and treating it as noise rewrites files during a migration that is supposed to move them.

5. **Diff on slugs, not filenames.** A page whose extension changed — `api/suggest.mdx` becoming
   `api/suggest.md` — is one override, not a deletion plus an addition. A filename diff gets this wrong
   silently, because the counts still add up.

6. **Convert the deletions.** A page present in an old snapshot but absent from the newer one already
   behaves correctly — it simply is not in the newer folder. A page you want _removed_ from a newer version
   while the file still exists needs a tombstone in that version.

7. **Convert the renames.** Add `renamedFrom` to the new file in the version that renamed it. Docusaurus
   had no equivalent, so this is new capability rather than a translation.

   Two rules, both learned by getting them wrong on a real corpus:

   - **A candidate the older version already served can never be a rename target.** The two pages
     coexisted, so a permanent redirect between them claims a move that never happened. On the measured
     tree, `atomic/changelog` matches the root `changelog` perfectly on name and title, and shares 1% of
     its body — a name-driven guess picks it confidently and is wrong.
   - **A line-identical body beats any filename.** A page that moved into a new directory _and_ was
     renamed scores nothing on its name and everything on its content. Trust the content.

   Apply both, then answer the slugs that are left one at a time — and expect **"nothing replaces it"** to
   be a legitimate answer. On the measured corpus three slugs needed a human, and it was the answer all
   three times: a tombstone without `replacedBy` tells a reader the page is gone and which version still
   has it, which beats sending them to a merely adjacent page.

## Be honest about the payoff

On the corpus this was measured against, 119 of ~160 shared files genuinely differ between two adjacent
versions. Deduplication is therefore a modest win: 351 committed files where there were 575, about 39%.
What actually changes:

- **Cutting a version costs nothing.** `docs-overlay cut 11.15.0` is a zero-byte content diff against
  ~190 copied files and a ~1.2 MB commit.
- **Navigation stops being duplicated.** The two `versioned_sidebars` files measured differed by a single
  line across 4 kB.
- **Deletions and renames become declarative** and reviewable, instead of manual surgery inside frozen
  folders — and a renamed page keeps its old URL working, which it did not before.
- **Drift becomes impossible rather than merely unlikely.** The tree that motivated this had a released
  version frozen three months behind its own working copy, with nothing reporting it. A version that holds
  only its differences cannot fall behind the one it inherits from.

## What is not supported

Versioned i18n. Fumadocs' `i18n.parser: "dir"` consumes the first path segment, which is the one the
version occupies. `0.x` does not combine the two.
