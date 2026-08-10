# Migration journal

Generated from `journal.jsonl` by `scripts/render-journal.mjs`. **Do not edit.**

26 entries across 8 phases. 23 steps a tool could take unattended, 3 that need a human.

## 1. setup — **pitfall**

Entries 1 to 8 were written together at the end of phase 0a, not one per step, because the journal and its validator did not exist yet when those steps ran. Every figure in them was re-derived from a command re-run at write time, so none is remembered. From entry 9 onward the migration-scribe subagent writes one entry per step, at the step.

**Pitfall** The dispositif that guarantees a journal is kept at the wall has to exist before the first step, and setting it up is itself a step. Bootstrapping it silently would make the first entries indistinguishable from reconstructed ones.

**Workaround** Declare the bootstrap window explicitly as entry 1, and re-derive every figure in entries 2-8 from a re-run command rather than from memory.

**Detectable by** A migration command should write its own first journal entry before touching anything, so the window never exists. `check-journal.mjs` cannot detect this on its own — hence the declaration.

<sub>`403b6b15` · 2026-08-10T09:56:32Z · owned by `migrate docusaurus`</sub>

## 2. setup — mechanical

Created worktree C:/dev/mint-release-11.14.0 on new branch chore/docs-overlay-migration from origin/release/11.14.0 (403b6b15). The three pre-existing worktrees all sit on origin/develop (01d246f1), so none of them could host work targeting the release branch.

```sh
git worktree add C:/dev/mint-release-11.14.0 -b chore/docs-overlay-migration origin/release/11.14.0
```

<sub>`403b6b15` · 2026-08-10T09:56:32Z · +967 −0 ~0</sub>

## 3. setup — **pitfall**

`git worktree add -b <topic> origin/release/11.14.0` set the new branch's upstream to origin/release/11.14.0. Detached it, so no push can reach the protected release branch by accident.

```sh
git branch --unset-upstream
```

**Pitfall** A topic branch created from a remote branch inherits that remote branch as upstream. A bare `git push` on it can then target a protected release branch instead of a branch of the same name.

**Workaround** `git branch --unset-upstream` immediately after creating the worktree, verified with `git rev-parse --abbrev-ref @{u}` returning a fatal error.

**Detectable by** `git rev-parse --abbrev-ref --symbolic-full-name @{u}` resolving to something other than a branch of the same name.

<sub>`403b6b15` · 2026-08-10T09:56:32Z · owned by `migrate docusaurus`</sub>

## 4. detect — measurement

Line-ending census of the three doc trees on release/11.14.0: 208 files are stored with CRLF in the index (51 in docs/, 123 of the 168 in versioned_docs/version-11.13.0, 34 in versioned_docs/version-11.14.0), 366 with LF, and 1 with neither (mint/features/search/components/record-card.mdx is 0 bytes). For every file the index and worktree endings agree, so the worktree bytes are the blob bytes.

```sh
git ls-files --eol -- docusaurus/docs docusaurus/versioned_docs docusaurus/versioned_sidebars docusaurus/versions.json | awk -F'\t' '{split($1,a," "); print a[1], a[2]}' | sort | uniq -c
```

<sub>`403b6b15` · 2026-08-10T09:56:32Z · owned by `migrate docusaurus / detect`</sub>

## 5. detect — **pitfall**

Parsed `git ls-files --eol` by whitespace column and got the literal string "eol=lf" where a path was expected, which produced a nonsense per-tree breakdown. The attribute column contains a space, so the path is only reliably reachable after the TAB.

```sh
git ls-files --eol -- docusaurus/docs | awk -F'\t' '{split($1,a," "); if(a[1]=="i/crlf") print $2}'
```

**Pitfall** `git ls-files --eol` output is `i/<eol> w/<eol> attr/<attrs>\t<path>`, and the attribute field itself contains spaces (`attr/text=auto eol=lf`). Splitting on whitespace yields an attribute fragment instead of the path, silently — the counts still look plausible.

**Workaround** Split on TAB for the path and only split field 1 on whitespace for the eol values.

**Detectable by** A per-tree breakdown whose group names are not paths, or whose total does not match the overall count.

<sub>`403b6b15` · 2026-08-10T09:56:32Z · owned by `migrate docusaurus / detect`</sub>

## 6. setup — verification

Took the pre-migration reference snapshot of docs/, versioned_docs/version-11.13.0, versioned_docs/version-11.14.0, versioned_sidebars/, versions.json and sidebars.js into a scratch directory outside the repository, then proved the copy is bit-exact by hashing all 574 copied files with --no-filters and comparing against the index OIDs.

```sh
git hash-object --no-filters --stdin-paths < refpaths.txt  # compared against `git ls-files -s`
```

**Verified** `diff <(cut -f1 want.txt) got.txt` → expected no difference across 574 files, got no difference across 574 files

<sub>`403b6b15` · 2026-08-10T09:56:32Z · +576 −0 ~0 · owned by `migrate docusaurus / verify`</sub>

## 7. setup — **pitfall**

`git hash-object --no-filters --stdin-paths` failed on every absolute path fed through stdin, reporting files that plainly existed as missing. MSYS path translation applies to command-line arguments only, not to stdin, so git.exe received /c/Users/... verbatim.

```sh
cut -f2 want.txt | sed "s#^#$(cygpath -m "$REF")/#" | git hash-object --no-filters --stdin-paths
```

**Pitfall** Under Git Bash on Windows, paths passed to a native git.exe through stdin are not converted from MSYS form (/c/...) to Windows form (C:/...). The failure names existing files as missing, which sends you looking for a copy bug that is not there.

**Workaround** Convert with `cygpath -m` before writing paths to stdin, or keep paths repository-relative.

**Detectable by** A `could not open ... No such file or directory` on a path that `test -f` confirms exists.

<sub>`403b6b15` · 2026-08-10T09:56:32Z</sub>

## 8. detect — **pitfall**

A sibling worktree on develop holds docusaurus/next/ as a 20-directory skeleton containing zero files, untracked. It does not exist on release/11.14.0, so this migration is not blocked by it, but the same debris would make `git mv docs content/docs/next` fail halfway through on that branch while `git status` reported a clean tree.

```sh
git status --porcelain  # clean, yet C:/dev/mint-11.14.0/docusaurus/next exists with 20 directories and 0 files
```

**Pitfall** git does not track directories, so an empty directory tree occupying a migration target is invisible to `git status`. A clean-tree check therefore does not prove the target paths are free.

**Workaround** Deleted the skeleton in the sibling worktree with `rm -rf`; nothing to commit, since git never tracked it.

**Detectable by** An explicit `existsSync(target)` on every destination path, refused independently of the clean-tree check.

<sub>`403b6b15` · 2026-08-10T09:56:32Z · owned by `migrate docusaurus`</sub>

## 9. detect — measurement

Computed the overlay diff between the reference copies of versioned_docs/version-11.13.0 (parent) and docs/ (child, to be promoted to 11.14.0), keyed on slugs -- path minus extension -- and comparing raw bytes for identity: parent 168 slugs, child 216 slugs, 159 shared of which 40 byte-identical (to be pruned; prune-list.txt holds exactly 40 paths) and 119 overrides, 57 added, 9 gone. Arithmetic check that the folded newest version reproduces today's tree: 168 - 9 + 57 = 216. Keying on slugs rather than filenames is what makes atomic/api/suggest.mdx -> atomic/api/suggest.md a single override instead of a deletion plus an addition; both files were confirmed present in the snapshot, one per side. Every figure matches classify-output.txt lines 1-3.

```sh
node classify-prototype.mjs <ref>/v11.13.0 <ref>/docs
```

<sub>`403b6b15` · 2026-08-10T10:05:28Z · owned by `migrate docusaurus / prune`</sub>

## 10. classify — **pitfall**

Ran the rename heuristic with the weights the engine will ship (0.60*content + 0.20*stem + 0.15*path + 0.05*title, accept at 0.75 with a 0.15 margin, ask from 0.45). mint/configurations/customization -> mint/configurations/customization/custom-json-files scored 0.700 and was routed to a human although both files are 397 lines (wc -l on both reference copies) with content 1.00 against a runner-up at 0.22. Divergence from the briefing, checked with diff: the frontmatter title changed (Via Sinequa Admin -> Custom Json files) and the child also adds sidebar_class_name: update, while the parent carries one trailing empty line the child does not -- the body lines are identical, but title is not the only difference.

```sh
node classify-prototype.mjs <ref>/v11.13.0 <ref>/docs
```

**Pitfall** A filename change alone can drag a weighted rename score under the accept threshold: content 1.00 on a 397-line line-identical body still landed at 0.700 because stem scored 0.00, so the strongest content evidence available produced a human question.

**Workaround** Added a branch evaluated before the weighted comparison: accept as a rename when content >= 0.95 and the runner-up's content is < 0.5. The uniqueness guard is what stops a genuinely duplicated page from being read as a move.

**Detectable by** Any vanished slug whose best candidate has content >= 0.95 while the weighted score falls below the accept threshold -- that combination means the weights, not the evidence, decided.

<sub>`403b6b15` · 2026-08-10T10:05:28Z · owned by `migrate docusaurus / classify`</sub>

## 11. classify — measurement

Final classification of the 9 vanished slugs after both corpus-driven rules (the existed-in-parent disqualifier and the identical-body branch of entry 10): 5 automatic renames (mint/configurations/filters 0.950, logos-and-title 0.950, routes 0.794, customization 0.700 via the identical-body branch, mint/how-to/localization 0.792), 2 silent tombstones (mint/features/search/components/record-card, confirmed 0 bytes, and mint/features/search/search-all, best candidate 0.150), and 2 asks that need a replacedBy answer rather than a rename target (atomic/changelog, mint/features/search/search). The existed-in-parent disqualifier is what demoted atomic/changelog -> changelog (stem 1.00, title 1.00, but content 0.00 and the target already served by 11.13.0) from a confident wrong rename to a question. Divergence from the briefing: the same disqualifier does hit mint/search-all-layout, verified byte-identical across the two trees (blob 7ea576d7), but it does not appear among search-all's three scored candidates in classify-output.txt and search-all's recorded verdict is a silent tombstone, not a question. recursive: true applies nowhere on this corpus -- mint/features/search/components/ holds exactly one page, so a recursive tombstone would be equivalent to a plain one, and mint/features/search/ loses three pages while gaining data-flow, so recursing there would tombstone a live page.

```sh
node classify-prototype.mjs <ref>/v11.13.0 <ref>/docs  # output captured in classify-output.txt
```

<sub>`403b6b15` · 2026-08-10T10:05:28Z · owned by `migrate docusaurus / classify`</sub>

## 12. setup — **pitfall**

Entries 12 to 25 were written together immediately after C4, so they share one timestamp; each carries the repo_head of the commit its step produced, not the branch head at writing time. This entry records the hook situation: core.hooksPath is .husky/_, a directory husky only creates during npm install, and this worktree has no node_modules, so .husky/_ does not exist and git runs no hooks at all. Verified by a throwaway commit that completed without lint-staged running.

```sh
git config core.hooksPath  # .husky/_ ; test -d .husky/_  # absent
```

**Pitfall** The formatter guard added in cee058eb is untested in this worktree: with no .husky/_ the pre-commit hook never fires, so nothing here can demonstrate that the guard stops oxfmt from rewriting a staged sidebars.json. It only takes effect for someone who has installed dependencies.

**Workaround** None needed for the migration itself, since no hook ran at any point; the guard was kept anyway because it matters for everyone else.

**Detectable by** test -d "$(git config core.hooksPath)"

<sub>`403b6b15` · 2026-08-10T10:24:29Z</sub>

## 13. config — mechanical

Excluded docusaurus/content/**, the generated trees (versioned_docs/, versioned_sidebars/, versions.json) and docusaurus/.docs-overlay/** from oxfmt and oxlint, by extending ignorePatterns in .oxfmtrc.json and .oxlintrc.json. Reason: lint-staged passes every staged *.json to oxfmt, which writes in place and forces endOfLine: lf, which would rewrite the pinned sidebars.json whose bytes must stay identical to the snapshot it is moved from. Scoped deliberately so docusaurus.config*.js and the rest of the site keep being formatted.

<sub>`cee058eb` · 2026-08-10T10:24:29Z · +0 −0 ~2 · owned by `migrate docusaurus / config`</sub>

## 14. move — **pitfall**

The first attempt moved both doc trees in one commit. It was content-correct, both destinations verified byte-identical to the reference, but the diff was misleading: 40 files are byte-identical across the two source trees, so git's rename detection paired them across trees and reported renames such as docusaurus/{docs => content/docs/11.13.0}/atomic-angular/components/aggregation.md for a file that actually came from versioned_docs/version-11.13.0. Measured at 80 mislabelled renames out of 385 (169 + 216).

```sh
git diff --cached -M --summary  # on the discarded single-commit staging
```

**Pitfall** Rename detection pairs on content, not on source tree. Moving two trees that share byte-identical files in a single commit makes git attribute files to the wrong origin, so the commit stops documenting what it actually did even though the resulting tree is correct.

**Workaround** git reset --hard, then split into two commits ordered base-tree-first (11.13.0, then 11.14.0), so the base tree is already in HEAD and cannot be a rename candidate for the second. Verified afterwards with git diff --cached -M --summary | grep -c 'docs =>' returning 0 on both.

**Detectable by** After staging a move, grep the rename summary for a source path belonging to a tree the commit is not supposed to be moving: git diff --cached -M --summary | grep -c 'docs =>'

<sub>`403b6b15` · 2026-08-10T10:24:29Z · owned by `migrate docusaurus / move`</sub>

## 15. move — mechanical

git mv of docusaurus/versioned_docs/version-11.13.0 to docusaurus/content/docs/11.13.0, and of versioned_sidebars/version-11.13.0-sidebars.json to content/docs/11.13.0/sidebars.json. 169 renames, all at R100, 0 insertions, 0 deletions, 0 files modified, 0 cross-tree pairings.

```sh
git mv docusaurus/versioned_docs/version-11.13.0 docusaurus/content/docs/11.13.0 && git mv docusaurus/versioned_sidebars/version-11.13.0-sidebars.json docusaurus/content/docs/11.13.0/sidebars.json
```

<sub>`9e480ae7` · 2026-08-10T10:24:29Z · +0 −0 ~169 · owned by `migrate docusaurus / move`</sub>

## 16. move — mechanical

git mv of docusaurus/docs to docusaurus/content/docs/11.14.0, plus a created docusaurus/content/docs/next/.gitkeep. 216 renames, all at R100, 1 creation, 0 insertions, 0 deletions.

```sh
git mv docusaurus/docs docusaurus/content/docs/11.14.0 && git add docusaurus/content/docs/next/.gitkeep
```

<sub>`e74dec24` · 2026-08-10T10:24:29Z · +1 −0 ~216 · owned by `migrate docusaurus / move`</sub>

## 17. setup — mechanical

Created the annotated tag docs/frozen-11.14.0-snapshot on 403b6b15 before dropping the frozen snapshot; its message records the 188 files, the drift figures and the git checkout line that recovers the tree. It could not be pushed: this environment has no network, DNS resolution of gitlab.chapsvision.in fails, so pushing it is left to the operator. The blobs survive in history regardless, so the tag is a convenience marker and an intent record, not the only safety net.

```sh
git tag -a docs/frozen-11.14.0-snapshot 403b6b15 -m '<message>'
```

<sub>`729a5439` · 2026-08-10T10:24:29Z · owned by `migrate docusaurus`</sub>

## 18. move — mechanical

git rm of docusaurus/versioned_docs/version-11.14.0 (188 files), docusaurus/versioned_sidebars/version-11.14.0-sidebars.json and docusaurus/versions.json: 190 deletions, no additions, so rename detection has nothing to pair and the diff cannot be misread.

```sh
git rm -r -q docusaurus/versioned_docs/version-11.14.0 docusaurus/versioned_sidebars/version-11.14.0-sidebars.json docusaurus/versions.json
```

<sub>`729a5439` · 2026-08-10T10:24:29Z · +0 −190 ~0 · owned by `migrate docusaurus / move`</sub>

## 19. prune — mechanical

git rm of the 40 files in content/docs/11.14.0 that are byte-identical to what they inherit from 11.13.0, so 11.14.0 now serves the 11.13.0 copy for those slugs. The list was regenerated from the two committed trees, keyed on slug and compared on raw bytes, and cross-checked equal to the prune-list.txt recorded earlier. This step has to be a command rather than a stored list, because a backport onto another branch has a different docs/ tree and therefore a different set.

```sh
git rm -q $(cat prune-list.txt)  # list regenerated from the two committed trees, compared on raw bytes
```

<sub>`32528861` · 2026-08-10T10:24:29Z · +0 −40 ~0 · owned by `migrate docusaurus / prune`</sub>

## 20. classify — **judgement**

Classified the vanished slug atomic/changelog (614 bytes, frontmatter title 'Recents Changes', a short page pointing at Atomic library changes). Both candidates the heuristic surfaced were rejected.

**Decision** Tombstone atomic/changelog with no replacedBy.

**Why** The two candidates were already disqualified as rename targets because 11.13.0 serves them too, and neither is a real successor. The root changelog (600 lines in 11.13.0) documents all notable changes to the SBA Mint project, a different product scope. The atomic/changelogs/ directory that 11.14.0 introduces has five files and no index page, so any pick among them is arbitrary. A pointer to a merely adjacent page is worse than telling the reader the page is gone and which version still has it.

**Not taken** `replacedBy: changelog -- which is what the 11.14.0 sidebar did, replacing the atomic/changelog entry with changelog` · `replacedBy: atomic/changelogs/CHANGELOG_v0.0.124_to_v0.0.129`

<sub>`32528861` · 2026-08-10T10:24:29Z · owned by `migrate docusaurus / classify`</sub>

## 21. classify — **judgement**

Classified the vanished slug mint/features/search/search ('Introduction to Search', 173 lines, sidebar_position: 0, terminology and prerequisites). Content similarity against its best candidate is 0.01.

**Decision** Tombstone mint/features/search/search with no replacedBy.

**Why** The only page left in that section is data-flow, whose own description calls it a deep dive into how search parameters, URL state, stores, TanStack Query and the rendered results are kept in sync. It addresses a different audience: pointing a newcomer at a deep dive is worse than telling them the introduction was removed and which version still carries it.

**Not taken** `replacedBy: mint/features/search/data-flow`

<sub>`32528861` · 2026-08-10T10:24:29Z · owned by `migrate docusaurus / classify`</sub>

## 22. classify — **judgement**

Classified the vanished slug mint/features/search/search-all ('Search All Component'), confirming the heuristic's silent verdict rather than overriding it. Its best scored candidate was 0.150 with content 0.00.

**Decision** Tombstone mint/features/search/search-all with no replacedBy.

**Why** mint/search-all-layout covers the same component and survives by inheritance, but it already existed in 11.13.0 byte-identically (blob 7ea576d7 in both trees), so the two pages coexisted and it never replaced anything. Recording it as the replacement would invent a move that did not happen.

**Not taken** `replacedBy: mint/search-all-layout`

<sub>`32528861` · 2026-08-10T10:24:29Z · owned by `migrate docusaurus / classify`</sub>

## 23. rename — mechanical

Wrote the overlay directives: overlay.renamedFrom into the frontmatter of the 5 renamed files, each coming out at exactly +2/-0; 4 bare overlay.deleted tombstones, added as new files at +7 each; and content/docs/11.14.0/sidebars.json, 258 lines, a round-trip-verified JSON serialisation of sidebars.js. 10 files, 296 insertions, 0 deletions. 11.14.0 needs its own navigation because the inherited 11.13.0 sidebar lists atomic/changelog, which this version tombstones, and lacks the categories this version adds; next/ ships none and inherits this one.

<sub>`9fcae372` · 2026-08-10T10:24:29Z · +5 −0 ~5 · owned by `migrate docusaurus / tombstone`</sub>

## 24. detect — **pitfall**

Corrected my own earlier claim from the line-ending census, that every git add of one of the 208 CRLF files rewrites CRLF to LF. Two experiments on the same file settled it: copying to a new path then git add yields i/lf and git warns that CRLF will be replaced by LF the next time git touches the file, whereas modifying the existing path then git add keeps i/crlf with a diff of exactly the changed lines. text=auto skips normalisation for a path the index already holds with CRLF, which is why git add --renormalize exists as a separate flag.

```sh
git ls-files --eol <path>  # before and after staging, on both a new and an existing path
```

**Pitfall** The claim was too broad. Renormalisation is confined to paths new to the index, which is precisely what a move creates, and precisely why git mv is mandatory here; it is also why adding overlay: blocks to five already-tracked files, three of them stored with CRLF, was safe and produced +2/-0 each. Believing the broad version would have made the safe edits look dangerous and made copy-then-add look no worse than git mv.

**Workaround** Use git mv for moves so no new index path is created; ordinary edits of already-tracked files need no precaution.

**Detectable by** git ls-files --eol <path> before and after staging, or the 'CRLF will be replaced by LF' warning git prints on add.

<sub>`9fcae372` · 2026-08-10T10:24:29Z · owned by `migrate docusaurus / move`</sub>

## 25. wrapup — measurement

Content migration complete. git ls-files docusaurus/content counts 351 files: 11.13.0 = 169 (168 pages + sidebars.json), 11.14.0 = 181 (119 overrides + 57 additions + 4 tombstones + sidebars.json), next = 1 (.gitkeep). Divergence from the briefing: the pre-migration total is 575, not 576 -- git ls-tree -r --name-only 403b6b15 -- docusaurus/docs docusaurus/versioned_docs docusaurus/versioned_sidebars docusaurus/versions.json gives 216 + 168 + 188 + 2 + 1 = 575, which matches the earlier census of 208 CRLF + 366 LF + 1 empty. Against 575 the reduction is 224 files, 39%. Not done yet: the site does not build, because versions.json, versioned_docs/ and versioned_sidebars/ are gone and nothing generates them yet.

```sh
git ls-files docusaurus/content | wc -l
```

<sub>`9fcae372` · 2026-08-10T10:24:29Z</sub>

## 26. wrapup — **pitfall**

Recorded a structural constraint of this setup: the journal lives in the docs-overlay repository while the migration was performed in sba-mint, so no single commit can carry both a step and the entry describing it.

```sh
node scripts/check-journal.mjs notes/migrations/mint-11.14.0/journal.jsonl --repo /c/dev/mint-release-11.14.0
```

**Pitfall** The rule that a journal entry ships in the same commit as the step it describes cannot hold across two repositories, so the usual proof that an entry was written at the wall rather than reconstructed afterwards is unavailable here.

**Workaround** Record repo_head on every entry and run check-journal.mjs --repo <migrated repo>, so the git cross-check replaces same-commit shipping as the anchor.

**Detectable by** A journal whose entries all share one repo_head while the migration spans several commits.

<sub>`9fcae372` · 2026-08-10T10:24:29Z</sub>

