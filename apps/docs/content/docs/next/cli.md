---
title: The command line
description: docs-overlay cut, check, prune and materialize — every flag, the first-invocation trap, and where each command belongs in a build.
---

Four commands. Three of them are universal — they only need version folders, so a Fumadocs site or a
plain repository of Markdown uses them exactly as a Docusaurus site does. The fourth writes the tree
Docusaurus insists on reading.

```bash
npm install -D docs-overlay-cli
```

> The first invocation is `npx docs-overlay-cli`, **not** `npx docs-overlay`: the latter resolves the
> _engine_ package, which has no bin, and fails with nothing useful to say. Afterwards the
> `docs-overlay` bin works from package scripts and `npm exec`.

| Command                      | What it does                                                      |
| ---------------------------- | ----------------------------------------------------------------- |
| `docs-overlay cut <version>` | the channel folder becomes that version                           |
| `docs-overlay check`         | the engine's diagnostics, with no framework build                 |
| `docs-overlay prune`         | drop files a version repeats from what it inherits                |
| `docs-overlay materialize`   | write the tree Docusaurus reads (needs `docs-overlay-docusaurus`) |

Options common to all four:

```text
--site-dir <path>          site root; default: the nearest ancestor with a docusaurus.config.*
--content-dir <path>       version folders; default: <site-dir>/content/docs
--out-dir <path>           what the tool owns and may delete; default: .docs-overlay
--channel <name>           repeatable; default: next
--route-base-path <path>   must match the docs plugin's routeBasePath; default: /
--label <id=text>          repeatable display label, e.g. --label next="Unreleased"
--json                     machine-readable output
```

An unknown flag is an **error**, not a warning. A mistyped `--dry-run` that silently did the real work
is the one failure this tool cannot afford.

## `cut <version>`

Renames the channel folder to that version and re-creates the channel empty.

```bash
docs-overlay cut 2.0.0
```

```text
--dry-run    print what would move
--no-git     plain filesystem move; history is not preserved
```

It uses `git mv`, and that is not a stylistic preference. A move renames the index entry and replays no
clean filter, so the blob identities survive and git records the whole cut as renames — zero insertions,
zero deletions. A copy-then-add would renormalise every CRLF file in the tree and turn the cheapest
operation in the model into a full-tree rewrite nobody can review. `--no-git` exists for a repository
that is not a git repository, and says what it costs.

Afterwards the emptied channel inherits everything from the version just cut, so `/next/` serves the
same pages until you write into it.

It refuses:

| When                                              | Because                                                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| the name is not one the engine reads as a version | it would be a _warning_ at build time and the whole folder would vanish from the site silently                              |
| the channel folder is missing                     | there is nothing to cut                                                                                                     |
| the channel holds no content yet                  | the new version would serve nothing of its own                                                                              |
| the target version folder already exists          | including as an empty untracked directory — git does not track directories, so a clean tree does not prove the path is free |

A prerelease is allowed, with a note: `2.0.0-rc.1` sorts **before** `2.0.0`.

## `check`

Runs the engine's diagnostics and nothing else — no framework, no bundler, no MDX compilation. Seconds,
which is what makes it the right thing to run on a content pull request.

```bash
docs-overlay check --fail-on warning
```

```text
--fail-on error|warning    default: error
```

What it reports: duplicate slugs, a tombstone with no target, a rename or alias colliding with a real
page, a redirect cycle or a redirect pointing at nothing, a folder whose name is not a version, an
ambiguous version order, an inheritance cycle. Twelve codes in all, each with a severity.

`--fail-on warning` is the stricter setting, and worth considering: a folder the engine cannot read as a
version is only a warning, and its content simply disappears from the site.

## `prune`

Deletes the files a version repeats **byte for byte** from what it inherits. The resolved site is
identical afterwards — the slug is served by inheritance instead of by a duplicate file.

```bash
docs-overlay prune --dry-run
```

```text
--version-id <V>   default: every version but the oldest, which inherits nothing
--dry-run          list what would go
--no-git           unlink instead of `git rm`
```

Two things it deliberately will not do. It compares **raw bytes**, not text, so a difference that is
only a line ending counts as a difference — treating it otherwise would rewrite the file during a
prune. And it keeps any file carrying an `overlay:` directive even when the bytes match, because
deleting it would take the rename or the alias with it and the slug would stop answering.

This is not only a migration step. Anything that writes into a version folder wholesale — a script
mirroring documentation out of a library repository, a bulk copy, a backport onto a maintenance
branch — recreates an override for every file it touches, including the ones identical to what they
inherit. Nothing breaks, so nothing reports it, and the repository quietly re-inflates until the overlay
stops meaning anything.

`git rm` refuses a file with staged or local changes, which is exactly the state a migration is in when
it prunes. The command says so and removes nothing rather than removing half.

## `materialize`

Writes what Docusaurus reads: `versions.json`, `versioned_docs/version-*/`,
`versioned_sidebars/*-sidebars.json`, and the current version's directory under `--out-dir`. Requires
`docs-overlay-docusaurus`, loaded through a lazy `import()` so a Fumadocs project never pulls Docusaurus
knowledge in.

```bash
docs-overlay materialize --check
```

```text
--check               write nothing; exit 1 if the tree is out of date
--no-clean            keep files a previous run wrote that this one does not
--allow-errors        finish despite content errors
--mark-added <class>     class for sidebar entries a version adds
--mark-changed <class>   class for sidebar entries a version changes
```

Both marks reach authored sidebar entries only; the manifest carries the same two sets so a
`sidebarItemsGenerator` can mark the autogenerated ones.

Two rules that are not configurable:

**It writes only where a manifest says it wrote before.** The generated tree lives at the paths
Docusaurus hardcodes — the same paths a site had under source control before migrating. A target that
exists and carries no sentinel is refused, with the `git rm -r --cached` to run. There is no `--force`
and no `--adopt`, because adopting a committed tree means deleting it on the next run, which is the
silent destruction the refusal exists for.

**It writes only when the bytes change.** Rewriting an identical file churns its mtime, and a churned
mtime is what makes a dev server rebuild in a loop.

## Where each one belongs

```json
{
  "scripts": {
    "prebuild": "docs-overlay materialize",
    "prestart": "docs-overlay materialize"
  }
}
```

- **`materialize`** in `prebuild` and `prestart`, on Docusaurus. It is a build step, not a thing you
  remember to run.
- **`materialize --check`** in CI. After the migration `docs/` is generated, and editing it is muscle
  memory for every Docusaurus contributor — the check turns that mistake into a failed build instead of
  an edit that disappears at the next build without a trace.
- **`check`** in CI on any content pull request, on either framework.
- **`cut`** in the release process. This repository runs the equivalent inside its "chore: version
  packages" pull request, so the cut is reviewed alongside the version bump.
- **`prune`** after anything that writes into a version folder in bulk.

## Exit codes

`0` on success, `1` on any refusal or failure — including `check` finding something at or above
`--fail-on`, and `materialize --check` finding the tree out of date. `--dry-run` exits `0` even when it
has plenty to report: it succeeded at reporting.

## Under Git Bash

MSYS rewrites arguments that look like absolute POSIX paths, so `--route-base-path /` reaches the
process as `C:/Program Files/Git/`. The command refuses such a value rather than quietly building every
generated link on top of it — the value only ends up inside links, so it would fail silently by
poisoning all of them rather than crashing.

```bash
MSYS2_ARG_CONV_EXCL='--route-base-path=' docs-overlay materialize --route-base-path=/
```

Excluding everything with `'*'` also stops `--site-dir` being converted, which then reaches Node as an
unresolvable `/c/...` path — so exclude per flag, or give paths in Windows form. Running it from a
package.json script avoids the whole problem, which is where it belongs anyway.
