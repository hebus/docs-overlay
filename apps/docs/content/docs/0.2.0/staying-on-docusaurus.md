---
title: Staying on Docusaurus
description: Keep the site you have. Author only the diff, and let the build write the tree Docusaurus expects.
---

There are two ways out of Docusaurus' snapshot versioning. This is the one where you **keep Docusaurus** —
its theme, its plugins, its search, its URLs — and stop maintaining snapshots. If you were going to change
framework anyway, [Migrating to Fumadocs](./migrating-to-fumadocs.md) is a shorter road.

The content model is the same either way: the oldest version folder holds the complete tree, every newer
one holds only what changed. What differs is the last mile.

## Why this one needs a materialiser

Docusaurus lets you configure exactly one source directory — the current version's `docs.path`.
`versioned_docs/version-X/`, `versioned_sidebars/` and `versions.json` sit at fixed paths, no option
supplies a source folder per version, and the docs plugin reads its version metadata **inside its own
factory**, before any hook of any plugin could intervene. There is no point at which an overlay could
resolve inheritance on the fly.

So the only window is before the build, and the only thing that fits through it is a real tree. The
adapter writes one.

**The consequence will surprise every contributor, so it is worth saying first:** `docs/`,
`versioned_docs/`, `versioned_sidebars/` and `versions.json` become **build output**. You edit
`content/docs/` instead. Editing `docs/` is muscle memory for anyone who has worked on a Docusaurus site,
and an edit made there survives until the next build and then disappears without a trace.

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

## Install

```bash
npm install -D docs-overlay docs-overlay-cli docs-overlay-docusaurus
```

> The first invocation is `npx docs-overlay-cli`, **not** `npx docs-overlay`: the latter resolves the
> engine package, which has no bin, and fails with nothing useful to say. Afterwards the `docs-overlay`
> bin works from package scripts and `npm exec`.

## The migration

```bash
npx docs-overlay-cli migrate docusaurus --site-dir docusaurus --dry-run
```

It reads `versions.json`, the snapshot folders and the `docs` block of your config, prints what it plans,
and writes nothing. Run it again without `--dry-run` when the plan looks right.

Two things it does that are worth knowing about, because both are invisible when they go wrong:

**It moves with `git mv`.** `.gitattributes` commonly carries `text=auto`, which normalises line endings
**on add** — and only for paths new to the index. A move creates exactly such a path, so copy-then-add
rewrites every CRLF file in the tree. On the measured corpus that was 174 of 385 files, which turns a pure
rename into a full-tree diff nobody can review.

**It diffs on slugs, not filenames.** A page whose extension changed — `api/suggest.mdx` becoming
`api/suggest.md` — is one override, not a deletion plus an addition. A filename diff gets this wrong
silently, because the counts still add up.

## The questions it will ask you

Everything mechanical is decided for you. What is left is a small number of genuine judgements, and the
tool asks rather than guesses.

**"This slug disappeared. Where should a reader go?"** For each vanished slug it has no confident answer
for, you get the ranked candidates with their evidence, and four answers: renamed to X, removed, removed
and replaced by X, or skip.

Expect "nothing replaces it" to be a common answer, and do not let the prompt talk you out of it. On the
measured corpus, three slugs reached a human and the answer was _nothing_ all three times: the page that
looked like a successor documented a different product, and the only page left in a section was a deep dive
rather than the introduction that had been removed. Sending a reader to a merely adjacent page is worse than
telling them the page is gone and which version still has it.

**"Is this what your config says?"** The config is not `import()`ed — that would execute arbitrary code and
drag in your whole toolchain — so a narrow extractor reads `docs.path`, `routeBasePath`, `lastVersion`,
`versions.current`, `sidebarPath` and `i18n.locales`, prints them with line numbers, and asks you to
confirm. Every value has an override flag for when the extractor gives up. A site with two config files is
asked once per file.

## What it decides without asking

Rename detection scores four axes — body content, filename stem, folder path, title — with content
weighted heaviest, because it is the only one that cannot be coincidence. Two rules were forced by a real
corpus rather than designed, and both exist to stop the tool from lying confidently:

**A candidate the older version already served can never be a rename target.** The two pages coexisted, so
a permanent redirect between them claims a move that never happened. On the measured tree,
`atomic/changelog` matches the root `changelog` perfectly on name and title and shares 1% of its body — a
name-driven heuristic picks it with confidence and is wrong. The rule demotes such candidates to
`replacedBy` suggestions, which turns a bad answer into an answerable question.

**A line-identical body beats any filename.** One page moved into a new directory _and_ was renamed: 397
lines on both sides, body identical, only the frontmatter changed. It scores `1.00` on content and `0.00`
on its stem, and the weighted score alone lands under the accept threshold — sending the strongest evidence
available to a human for no reason. A uniqueness guard on the runner-up keeps a genuinely duplicated page
from being read as a move.

On the measured corpus: **five renames accepted automatically, one silent tombstone, three questions.**

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

| It refuses when                                                  | Because                                                                                                                                       |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| the git tree is dirty                                            | a migration has to be reproducible from a commit                                                                                              |
| the content directory exists and is not empty                    | already migrated, or about to be mixed with something else                                                                                    |
| a target path exists — **even as an empty untracked directory**  | git does not track directories, so a clean tree does not prove the path is free; the debris of an earlier attempt makes `git mv` fail halfway |
| a version folder's name is not one the engine reads as a version | it would be reported as a _warning_ and the whole folder would vanish from the site silently                                                  |
| two files in one snapshot resolve to the same slug               | one of them stops being reachable, and which one is not the tool's call                                                                       |
| `i18n.locales` has more than one entry                           | versioned i18n is not supported                                                                                                               |
| a generated directory exists and was not generated by this tool  | those are the paths your site kept under source control; adopting one means deleting it on the next run                                       |
| a URL-valued flag arrives looking like `C:/Program Files/Git/…`  | MSYS argument conversion under Git Bash — the value only ends up inside generated links, so it would poison all of them rather than crash     |

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
