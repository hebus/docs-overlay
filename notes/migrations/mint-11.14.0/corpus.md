# The Mint 11.14.0 corpus

Every figure the documentation quotes comes from here, and every figure here comes from a command
recorded next to it. Re-run them before quoting them anywhere else — the trees move.

- Repository: `sba-mint`, branch `origin/release/11.14.0` at `403b6b15`
- Site: `docusaurus/`, Docusaurus 3.10, preset classic, `routeBasePath: '/'`, `onBrokenLinks: 'throw'`
- Reference snapshot: taken with a plain copy, then proved bit-exact against the index OIDs with
  `git hash-object --no-filters` over all 574 files

## What was there before

| Tree                                    | Files (`.md`/`.mdx`) | Serves                                             |
| --------------------------------------- | -------------------- | -------------------------------------------------- |
| `docs/`                                 | 216                  | `/next/…`, labelled `Next 🚧`                      |
| `versioned_docs/version-11.14.0/`       | 188                  | the site root (`lastVersion`)                      |
| `versioned_docs/version-11.13.0/`       | 168                  | `/11.13.0/…`                                       |
| `versioned_sidebars/`                   | 2                    | one snapshot of `sidebars.js` per released version |
| `versions.json`                         | 1                    | the declared version list                          |
| **total, doc trees plus version index** | **575**              |                                                    |
| `sidebars.js`                           | 1                    | also becomes generated, so 576 counting it         |

Both totals appear in the record because both are defensible; the difference is only whether
`sidebars.js` is counted. It is stated as **575** wherever the doc trees and the version index are
meant, which is what
`git ls-tree -r --name-only 403b6b15 -- docusaurus/docs docusaurus/versioned_docs docusaurus/versioned_sidebars docusaurus/versions.json | wc -l`
returns, and it reconciles with the line-ending census below: 208 + 366 + 1 = 575.

The two `versioned_sidebars` files are ~4 kB each and differ by a single line.

`versioned_docs/`, `versioned_sidebars/`, `versions.json`, both `docusaurus.config*.js`,
`package.json` and `package-lock.json` are **identical** between `origin/develop` and
`origin/release/11.14.0`. Only `docs/`, `sidebars.js` and `src/css/custom.css` differ. That is why the
move commits backport cleanly and the two content commits do not.

## The drift that motivated the migration

`versioned_docs/version-11.14.0` was frozen on 2026-04-11 and touched three times since, while `docs/`
kept moving. Measured against `docs/`, the version served **at the site root** was missing 57 slugs and
differed on 119 of 159 shared ones. Nothing in the toolchain reported this.

## After the migration

`docs/` is promoted to `content/docs/11.14.0/`, `versioned_docs/version-11.13.0` becomes
`content/docs/11.13.0/`, and the frozen 11.14.0 snapshot is dropped (recoverable from the tag
`docs/frozen-11.14.0-snapshot`).

The diff is computed on **slugs** — path minus extension — not on filenames:

```
node classify-prototype.mjs <ref>/v11.13.0 <ref>/docs
```

```
parent 168 slugs · child 216 slugs
shared 159 -> identical 40 / overrides 119
added 57 · gone 9
```

|                                                                                           | Files                                       |
| ----------------------------------------------------------------------------------------- | ------------------------------------------- |
| `content/docs/11.13.0/` — the complete tree, frozen                                       | 168 + 1 `sidebars.json`                     |
| `content/docs/11.14.0/` — 119 overrides + 57 additions + 4 tombstones + 1 `sidebars.json` | 181                                         |
| `content/docs/next/` — emptied channel                                                    | 1 `.gitkeep`                                |
| **total committed**                                                                       | **351** vs 575 — 224 files fewer, **−39 %** |
| dropped as identical to what they inherit                                                 | 40 (see `prune-list.txt`)                   |

Arithmetic check on the folded newest version: 168 − 9 + 57 = **216**, exactly today's `docs/`.

### Why the slug matters and the filename does not

`atomic/api/suggest.mdx` in 11.13.0 becomes `atomic/api/suggest.md` in 11.14.0. Same slug, different
extension: an override, not a deletion plus an addition. A filename diff gets this wrong, and gets it
wrong silently — the counts still add up.

## The 9 vanished slugs

Scored with the metric the engine will ship (line-multiset intersection over bodies with frontmatter
stripped), weights `0.60·content + 0.20·stem + 0.15·path + 0.05·title`, accept at `0.75` with a `0.15`
margin, ask from `0.45`. Full evidence in `classify-output.txt`.

| Slug                                          | Verdict                           | Target                                  | Score / evidence                                   |
| --------------------------------------------- | --------------------------------- | --------------------------------------- | -------------------------------------------------- |
| `mint/configurations/filters`                 | rename, auto                      | `…/customization/filters`               | 0.950 — content 1.00, stem 1.00                    |
| `mint/configurations/logos-and-title`         | rename, auto                      | `…/customization/logos-and-title`       | 0.950 — content 1.00, byte-identical               |
| `mint/configurations/customization`           | rename, auto                      | `…/customization/custom-json-files`     | content **1.00** on 397 lines; score only 0.700    |
| `mint/configurations/routes`                  | rename, auto                      | `…/customization/routes`                | 0.794 — content 0.74, stem 1.00                    |
| `mint/how-to/localization`                    | rename, auto                      | `mint/how-to/localisation/localization` | 0.792 — content 0.74, stem 1.00                    |
| `mint/features/search/components/record-card` | tombstone, silent                 | —                                       | 0 bytes; best candidate 0.112                      |
| `mint/features/search/search-all`             | tombstone, silent                 | —                                       | best candidate 0.150                               |
| `atomic/changelog`                            | **tombstone, `replacedBy` asked** | `changelog`?                            | 614 B stub; content 0.00 against a 24 kB root page |
| `mint/features/search/search`                 | **tombstone, `replacedBy` asked** | ?                                       | best 0.155; no plausible successor                 |

`recursive: true` does not apply anywhere here: `mint/features/search/components/` holds exactly one
page, so a recursive tombstone would be equivalent to a plain one, and
`mint/features/search/` loses three pages but gains `data-flow`, so recursion there would be wrong.

### Two rules the corpus forced, both discovered by running the heuristic

**A candidate the parent version already served can never be a rename target.** The two pages
coexisted, so a permanent redirect between them would claim a move that never happened. `atomic/changelog`
scores `stem 1.00 / title 1.00` against both `changelog` and `atomic-angular/changelog`, and a
name-driven heuristic proposes one of them confidently and wrongly. The rule demotes both to
`replacedBy` candidates and turns a bad answer into an answerable question. The same rule disqualifies
`mint/search-all-layout`, which already existed in 11.13.0 byte-identically.

**A line-identical body against a candidate nothing else comes near is a rename, whatever the
filename says.** `mint/configurations/customization` → `customization/custom-json-files` is 397 lines
on both sides with an identical body. The frontmatter differs — `title` changed from `Via Sinequa
Admin` to `Custom Json files`, the child adds `sidebar_class_name: update`, and the parent carries one
trailing blank line the child does not — but not a body line. It scores `content 1.00` against a
runner-up at `0.22`, and still lands at **0.700**, below the 0.75 accept threshold, purely because
`stem` scores `0.00`. The weighted score alone therefore sends the strongest evidence available to a
human. The fix is a branch evaluated before the weighted comparison: accept when `content ≥ 0.95` and
the runner-up's content is `< 0.5`. The uniqueness guard is what keeps a genuinely duplicated page
from being mistaken for a move.

With both rules: **5 automatic renames, 2 silent tombstones, 2 questions.**

Note what the disqualifier does _not_ do here. It marks `mint/search-all-layout` ineligible — the file
already existed in 11.13.0, byte-identically, blob `7ea576d7` — but that is not what decides
`mint/features/search/search-all`. That slug's best scored candidate is `mint/features/search/data-flow`
at `0.150` with `content 0.00`, so it falls below the ask threshold on its own and becomes a silent
tombstone; `search-all-layout` never even enters its candidate list. The disqualifier's one visible
effect on this corpus is `atomic/changelog`.

## Line endings

```
git ls-files --eol -- docusaurus/docs docusaurus/versioned_docs docusaurus/versioned_sidebars docusaurus/versions.json
```

|                 | Files                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| `i/crlf w/crlf` | **208** — 51 in `docs/`, **123 of the 168** in `version-11.13.0`, 34 in `version-11.14.0` |
| `i/lf w/lf`     | 366                                                                                       |
| `i/none w/none` | 1 — `mint/features/search/components/record-card.mdx`, 0 bytes                            |

`.gitattributes` says `*.md text=auto eol=lf`. Index and worktree endings agree on every file, which is
what makes the reference snapshot a plain copy.

**The renormalisation risk is narrower than it first looks, and knowing where it actually bites is what
makes the move safe.** Measured with two experiments on the same CRLF file:

| Operation                                    | Index ending after `git add`                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| copy to a **new** path, then `git add`       | `i/lf` — renormalised, and git warns _"CRLF will be replaced by LF the next time Git touches it"_ |
| modify the **existing** path, then `git add` | `i/crlf` — untouched, diff is exactly the lines changed                                           |

`text=auto` normalises on add, but git skips the conversion when the index already holds that path with
CRLF — which is why `git add --renormalize` has to exist as a separate flag. So editing a tracked CRLF
file is safe, and the danger is confined to **paths that are new to the index**.

That is exactly what a move creates. **Hence `git mv` rather than copy-then-add**: it renames the index
entry and replays no filter, so the blob OID survives. 174 of the moved files would otherwise have been
rewritten, and the whole "cutting a release is a zero-byte content diff" claim rests on this.

The same asymmetry is why adding `overlay:` blocks to five already-tracked files was safe: three of the
five are CRLF, and each came out as a clean `+2 / -0`.
