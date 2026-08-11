---
title: Versioning Docusaurus documentation without snapshots
description: Keep Docusaurus — its theme, its plugins, its URLs — and stop maintaining one full snapshot per version. Author only the diff, and let a prebuild step write the tree Docusaurus insists on reading.
---

There are two ways out of Docusaurus' snapshot versioning. This is the one where you **keep Docusaurus** —
its theme, its plugins, its search, its URLs — and stop maintaining snapshots. If you were going to change
framework anyway, [Migrating to Fumadocs](./migrating-to-fumadocs.md) is a shorter road.

The content model is the same either way: the oldest version folder holds the complete tree, every newer
one holds only what changed. What differs is the last mile.

## In short

```bash
npm install -D docs-overlay docs-overlay-cli docs-overlay-docusaurus
```

> The first invocation is `npx docs-overlay-cli`, **not** `npx docs-overlay`: the latter resolves the
> engine package, which has no bin, and fails with nothing useful to say. Afterwards the `docs-overlay`
> bin works from package scripts and `npm exec`.

Your versions become folders under `content/docs/`, and four commands do the rest:

| Command                    | What it is for                                                    |
| -------------------------- | ----------------------------------------------------------------- |
| `docs-overlay materialize` | writes the tree Docusaurus reads. A `prebuild` step               |
| `docs-overlay check`       | content diagnostics in seconds, with no framework build           |
| `docs-overlay cut 11.15.0` | the channel folder becomes that version, as renames               |
| `docs-overlay prune`       | drops files a version repeats byte for byte from what it inherits |

And five paths stop being source and become build output — this is the part that surprises every
contributor, so it is the first thing to say:

```text
docs/  versioned_docs/  versioned_sidebars/  versions.json  .docs-overlay/
```

## Why this one needs a materialiser

Docusaurus lets you configure exactly one source directory — the current version's `docs.path`.
`versioned_docs/version-X/`, `versioned_sidebars/` and `versions.json` sit at fixed paths, no option
supplies a source folder per version, and the docs plugin reads its version metadata **inside its own
factory**, before any hook of any plugin could intervene. There is no point at which an overlay could
resolve inheritance on the fly.

So the only window is before the build, and the only thing that fits through it is a real tree. The
adapter writes one.

Which is why those five paths above become **build output**. You edit `content/docs/` instead. Editing
`docs/` is muscle memory for anyone who has worked on a Docusaurus site, and an edit made there survives
until the next build and then disappears without a trace.

The honest mitigation is a check, not a warning in a README:

```bash
docs-overlay materialize --check   # exits non-zero when the tree does not match content/
```

Put it in CI. It turns that mistake into a failed build instead of silent data loss.

## Before and after

```
BEFORE                                  AFTER
docusaurus/                             docusaurus/
  docs/                     216 files     content/docs/
  versioned_docs/                           11.13.0/          168   complete tree
    version-11.14.0/        188 files        11.14.0/          181   only what differs
    version-11.13.0/        168 files        next/               1   .gitkeep
  versioned_sidebars/         2 files
  versions.json                           (everything else generated, gitignored)
  sidebars.js
                            575 committed                     351 committed   −39%
```

Those are real numbers from the site this was built for. Note what they do **not** say: deduplication is a
modest win, because 119 of the 160 shared files genuinely differ. The payoff is elsewhere — see
[Living with it](#living-with-it).

## Moving your snapshots into an overlay

There is no command that does this for you. It is a one-off rearrangement of a tree, done once per site,
and the mapping is mechanical enough to do by hand:

| Docusaurus                                         | Overlay                                         |
| -------------------------------------------------- | ----------------------------------------------- |
| `versioned_docs/version-11.13.0/`                  | `content/docs/11.13.0/`                         |
| `versioned_sidebars/version-11.13.0-sidebars.json` | `content/docs/11.13.0/sidebars.json`            |
| `docs/` — the current, unreleased version          | `content/docs/next/`                            |
| `versions.json`                                    | deleted; the folders _are_ the list of versions |

```bash
mkdir -p docusaurus/content/docs
git mv docusaurus/versioned_docs/version-11.13.0 docusaurus/content/docs/11.13.0
git mv docusaurus/versioned_sidebars/version-11.13.0-sidebars.json docusaurus/content/docs/11.13.0/sidebars.json
git mv docusaurus/docs docusaurus/content/docs/next
git rm docusaurus/versions.json
```

Repeat the first two lines per released version, oldest first. Then let the tools finish the job:

```bash
docs-overlay prune    # every file a newer version repeats byte for byte from what it inherits
docs-overlay check    # duplicate slugs, tombstones with no target, redirects that go nowhere
```

At that point every version still serves exactly what it served before — `prune` only removes files whose
bytes are already reachable by inheritance, and it keeps any file carrying an `overlay:` directive even
when the bytes match, because deleting it would take the rename or the alias with it.

Two things about doing it this way are invisible when they go wrong:

**Move with `git mv`; never copy-then-add.** `.gitattributes` commonly carries `text=auto`, which
normalises line endings **on add** — and only for paths new to the index. A move creates exactly such a
path, so copy-then-add rewrites every CRLF file in the tree. On the measured corpus that was 174 of 385
files, which turns a pure rename into a full-tree diff nobody can review.

**Compare on slugs, not filenames, when you decide what actually changed.** A page whose extension
changed — `api/suggest.mdx` becoming `api/suggest.md` — is one override, not a deletion plus an addition.
A filename diff gets this wrong silently, because the counts still add up. `prune` keys on slugs for the
same reason.

## Deciding what replaced what

Once the folders are in place, the newer version holds an override for everything that differs. What is
left is the set of slugs the newer version no longer has, and each one is a judgement: was it renamed, or
is it gone? Write the answer as a directive — `renamedFrom` on the new file, or a tombstone carrying
`replacedBy` — in the version that introduces the change.

Two rules were forced by a real corpus rather than designed, and both are worth knowing before you guess:

**A page the older version already served is never a rename target.** The two coexisted, so a permanent
redirect between them claims a move that never happened. On the measured tree, `atomic/changelog` matches
the root `changelog` perfectly on name and title and shares 1% of its body — anything driven by names
picks it confidently and is wrong. That is a `replacedBy` at best.

**An identical body beats any filename.** One page moved into a new directory _and_ was renamed: 397 lines
on both sides, body identical, only the frontmatter changed. Nothing about its name says so. Compare
bodies before you compare names.

And expect **"nothing replaces it"** to be a common answer. On the measured corpus three slugs needed a
human and the answer was _nothing_ all three times: the page that looked like a successor documented a
different product, and the only page left in a section was a deep dive rather than the introduction that
had been removed. Sending a reader to a merely adjacent page is worse than telling them the page is gone
and which version still has it — which is exactly what a tombstone without `replacedBy` does.

## Wiring the build

```json
{
  "scripts": {
    "materialize": "docs-overlay materialize",
    "verify": "docs-overlay materialize --check",
    "check": "docs-overlay check",
    "prebuild": "npm run materialize",
    "prestart": "npm run materialize"
  }
}
```

Then spread the derived options into the `docs` preset and ignore the generated trees:

```text
/docs/
/versioned_docs/
/versioned_sidebars/
/versions.json
/.docs-overlay/
```

**Anchor those with a leading slash.** An unanchored `docs/` also matches `content/docs/` and would hide
every source file you just committed — a failure that looks like a disappearance rather than an error.

`materialize` writes the `docs` plugin block into its manifest, and your config reads it back. That is
worth doing even with one config file, because `lastVersion` stops being a string somebody has to remember
to bump; with two config files — one per deployment target — it is what stops them contradicting each other.

Three things a real build taught us here, all of which cost a failed build to find:

- **`import.meta` cannot appear anywhere in a Docusaurus config**, not even in a branch that never runs.
  Docusaurus loads configs through jiti, which transpiles them to CJS and evaluates them with `vm.Script`,
  so it is a `SyntaxError` at compile time. Use `__dirname`, which jiti provides.
- **`require` is not in scope in an ESM config imported by another config.** If you factored a shared base
  out, `require.resolve('some-plugin')` has to become the plain plugin name — Docusaurus resolves it against
  the site directory itself, which is what `require.resolve` was standing in for.
- **Generated links carry no `baseUrl`.** They resolve it with `useBaseUrl` at build time, so one
  materialisation serves every deployment target and `materialize --check` in CI does not depend on which
  target ran last.

## Proving it did not lose anything

This is the section that should make you willing to merge it.

```bash
docs-overlay materialize
diff -r --brief <reference>/versioned_docs/version-11.13.0 versioned_docs/version-11.13.0
```

Take a copy of the pre-migration trees first — with `git cat-file`, or a plain copy if `git ls-files --eol`
shows the index and worktree endings agree; not `git archive`, which applies filters. Then materialise and
compare. On the corpus this was built for:

- the oldest version came out **byte-identical** across all 168 files;
- `versions.json` and the oldest version's sidebar came out byte-identical;
- the newest version differed from the pre-migration tree in exactly two intended ways: the generated
  stubs, and the `+2` lines of `overlay:` the migration itself added to five files;
- **all three generated sidebars are valid for their own version** — every doc id resolves to a file that
  exists, every `autogenerated` directory exists. That is the check that catches the tempting mistake of
  applying one shared `sidebars.js` to every version, which fails the build with
  `These sidebar document ids do not exist`;
- both builds passed with `onBrokenLinks: 'throw'`, 620 pages each, from a single materialisation;
- a second `materialize` wrote nothing.

## Living with it

```bash
docs-overlay cut 11.15.0    # next/ becomes 11.15.0, the channel comes back empty
docs-overlay check          # content diagnostics, seconds, no build
docs-overlay prune          # after anything that writes into a version wholesale
```

`prune` is not only a migration step. Anything that copies into a version folder in bulk — a script
mirroring documentation out of a library repository, a backport onto another branch — recreates an override
for every file it touches, including the ones identical to what they inherit. Nothing breaks, so nothing
reports it, and the repository quietly re-inflates until the overlay stops meaning anything.

And the real payoff, which is not the 39%:

- **Cutting a release costs nothing.** A folder rename, no content diff.
- **Navigation stops being duplicated.** A version that did not change its sidebar ships none.
- **Deletions and renames are declarative and reviewable**, and a renamed page keeps its old URL working.
- **Drift becomes impossible rather than merely unlikely.** The site that motivated this had its released
  version frozen three months behind its own working copy, with nothing reporting it. A version that holds
  only its differences cannot fall behind the one it inherits from.

There is a cost on the other side, and it is worth naming: the pruned files create an invisible coupling.
Editing a file in an old version changes what every version inheriting it serves. `docs-overlay check`
lists what a version serves by inheritance, and that is worth a CI job of its own.

## When it refuses

Every refusal below was met for real during the migration this page describes.

| Command       | It refuses when                                                             | Because                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `cut`         | the target version folder exists — **even as an empty untracked directory** | git does not track directories, so a clean tree does not prove the path is free; the debris of an earlier attempt makes `git mv` fail halfway |
| `cut`         | the name is not one the engine reads as a version                           | it would be reported as a _warning_ and the whole folder would vanish from the site silently                                                  |
| `cut`         | the channel folder is missing, or holds no content yet                      | there is nothing to cut, and creating an empty version would add a folder that serves only inherited pages                                    |
| `check`       | two files in one version resolve to the same slug                           | one of them stops being reachable, and which one is not the tool's call                                                                       |
| `materialize` | a generated directory exists and was not generated by this tool             | those are the paths your site kept under source control; adopting one means deleting it on the next run                                       |
| any           | a URL-valued flag arrives looking like `C:/Program Files/Git/…`             | MSYS argument conversion under Git Bash — the value only ends up inside generated links, so it would poison all of them rather than crash     |

There is no `--force` and no `--adopt` for the generated-directory refusal. Taking that step is a human's
job, once, on purpose:

```bash
git rm -r --cached versioned_docs versioned_sidebars versions.json docs
rm -rf versioned_docs versioned_sidebars versions.json docs
```

## What is not supported

**Versioned i18n.** Docusaurus keeps translations under
`i18n/<locale>/docusaurus-plugin-content-docs/version-X/`, keyed by version, and `0.x` does not fold that
second axis.

**Editing `docs/`.** It is generated. This is not a limitation that can be lifted: Docusaurus offers no
per-version source directory and no virtual-content hook, which is the whole reason a materialiser exists.
