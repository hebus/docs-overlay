---
"docs-overlay-cli": patch
---

`prune` no longer says it removed files before trying to remove them.

It printed `removed <path>` for every candidate, then ran a single `git rm`. When that failed the output had
already claimed the work was done — and it fails in exactly the state a migration is in when it prunes:
`git rm` refuses a file carrying staged or local changes, which every file does right after the edit that
made it redundant.

The list is now printed without a verb, because at that point it is a finding; the count is reported once
the removal has actually happened. The failure message names both remedies — commit first, or `--no-git` —
instead of only the second.
