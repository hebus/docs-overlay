# Migration journal

Generated from `journal.jsonl` by `scripts/render-journal.mjs`. **Do not edit.**

66 entries across 11 phases. 60 steps a tool could take unattended, 6 that need a human.

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

## 27. build — **pitfall**

Established why the adapter copies pages byte for byte instead of re-emitting their frontmatter: Docusaurus' doc frontmatter Joi schema ends in .unknown() (docusaurus-plugin-content-docs/src/frontMatter.ts), so an overlay: key in a page's frontmatter passes validation untouched. Byte copying is also what preserves CRLF endings, encoding, @theme/Tabs imports and mermaid blocks. Divergence from the briefing worth recording: the schema claim was not re-verified at this instant, because neither /c/dev/docs-overlay nor /c/dev/mint-release-11.14.0 has any @docusaurus package installed; it rests on the earlier reading of the upstream source.

**Pitfall** Had the frontmatter schema been strict instead of .unknown(), stripping the overlay: block would have had to be the default, and every copied page would have become a rewrite -- losing its line endings, encoding and MDX imports as a side effect of a validation rule.

**Workaround** None needed; withoutOverlayBlock() is exported for a caller who would rather not ship the directive to the built site.

**Detectable by** A site build failing with a frontmatter validation error naming overlay.

<sub>`9fcae372` · 2026-08-10T11:04:52Z · owned by `materialize`</sub>

## 28. build — **pitfall**

Removed generated stubs from the doc-id and directory sets the sidebar merger treats as valid. The first version of the adapter added each generated stub's doc id to docIds, and two failures followed, both caught by tests: an inherited sidebar kept the entry for a page the version had tombstoned, and a renamed page's sidebar reference was never rewritten because the old doc id still looked present. materialize.ts now carries the exclusion and its reason at lines 184-187.

```sh
npx vitest run packages/adapters/docusaurus
```

**Pitfall** Counting a stub as a page makes the slug it occupies look alive to the sidebar merger, so pruneMissing() keeps a tombstoned entry and the rename rewrite never fires -- the sidebar then points at a redirect or at an unlisted 'removed in' page instead of the real one.

**Workaround** Stubs are deliberately excluded from docIds and dirNames -- a stub is a route, not a page.

**Detectable by** A sidebar that still names a slug getEntries() reports as deleted or redirect.

<sub>`9fcae372` · 2026-08-10T11:04:52Z · +0 −0 ~1 · owned by `materialize`</sub>

## 29. build — **pitfall**

The adapter's architecture test scans its own sources for forbidden imports and flagged templates.ts for importing @docusaurus/Redirect and @docusaurus/Head. Those imports are inside template literals: they belong to the MDX the stubs emit, and are resolved by the site, not by this package.

```sh
npx vitest run packages/adapters/docusaurus
```

**Pitfall** An architecture check that reads sources as text cannot tell an import from a string that merely contains one, so it reported a violation the package does not commit; exempting the file wholesale would have stopped checking the one module most likely to reach for Docusaurus.

**Workaround** Strip template literals before scanning, plus a second test ('still sees an import that hides outside a template literal') proving the stripper does not swallow a real import sitting outside one -- guarding the guard.

**Detectable by** An architecture check that reports a violation in a file whose only match is inside a string literal.

<sub>`9fcae372` · 2026-08-10T11:04:52Z · +0 −0 ~1</sub>

## 30. build — **pitfall**

tsc -p packages/adapters/docusaurus failed on the architecture test with Cannot find name 'node:fs': Node's ambient types are not in that project's scope. Moved the test to packages/adapters/docusaurus/test/ with its own tsconfig declaring types: ["node"], mirroring packages/core/test/, and registered that project in the root typecheck script. npm run typecheck now runs five tsc projects and exits clean.

```sh
tsc -p packages/adapters/docusaurus
```

**Pitfall** The shorter fix -- adding Node's types to the adapter's src project -- would have put process, Buffer and node:fs in scope for src/, so 'this adapter performs no I/O' would have become a stated intention instead of a checkable claim: a stray readFileSync in src/ would then compile without complaint.

**Workaround** A separate test project declaring types: ["node"], keeping Node's ambient types out of src/ entirely; the root typecheck script runs tsc -p packages/adapters/docusaurus/test alongside the src project.

**Detectable by** npm run typecheck

<sub>`9fcae372` · 2026-08-10T11:04:52Z · +2 −0 ~1</sub>

## 31. build — mechanical

Built packages/adapters/docusaurus (docs-overlay commit fe22811: 17 files added, 2 changed, 1490 insertions). materialize() returns a description of files to copy and files to write and performs no I/O itself. Also exported: docusaurusSlugify(), covering the three Docusaurus conventions where a file takes its folder's URL (index, README, and a file named after its own folder, case-insensitively), readDocusaurusDirectives(), withoutOverlayBlock(), pruneMissing(), strictSidebars(), referencesOf(), defaultTemplates, docUrl(), docIdOf() and declaredSlug(). Registered in the root build/typecheck/typecheck:packaged scripts and in the PACKAGES list of scripts/release.ts. Tests: 14 unit tests in src/materialize.test.ts plus architecture tests in test/architecture.test.ts, 18 in total, all filesystem-free except the architecture test, which reads its own package's sources. Divergence from the briefing: there are 4 architecture tests, not 3 -- the fourth is 'declares the core as its only dependency, and no peers'.

```sh
npx vitest run packages/adapters/docusaurus --reporter=verbose
```

<sub>`9fcae372` · 2026-08-10T11:04:52Z · +17 −0 ~2 · owned by `materialize`</sub>

## 32. verify — verification

Ran the adapter against the real migrated tree through notes/migrations/mint-11.14.0/materialize-prototype.ts: 350 entries in, 600 files copied, 22 files written, 10 redirects, zero diagnostics. Versions came out as 11.13.0 -> /11.13.0, 11.14.0 at the root and next -> /next, which is the URL shape the site has today. The output holds 622 files: 168 under versioned_docs/version-11.13.0, 225 under versioned_docs/version-11.14.0, 225 under .docs-overlay/current, 2 versioned sidebars, 1 channel sidebar and versions.json.

```sh
npx tsx notes/migrations/mint-11.14.0/materialize-prototype.ts /c/dev/mint-release-11.14.0/docusaurus <out-dir>
```

**Verified** `npx tsx notes/migrations/mint-11.14.0/materialize-prototype.ts /c/dev/mint-release-11.14.0/docusaurus <out-dir>  # run twice into two different out-dirs, comparing the digest it prints` → expected two consecutive runs into two separate output directories print the same digest, and neither run reports a diagnostic, got Both runs printed the digest 4e5e7f49b51c1f59, so the output is deterministic. Both reported 350 entries, 600 copied, 22 written, 10 redirects, and printed no diagnostic line.

<sub>`9fcae372` · 2026-08-10T11:04:52Z · owned by `materialize`</sub>

## 33. verify — verification

Compared the materialised output against the pre-migration reference snapshot, extracted with git archive 403b6b15 (575 files: docs 216, versioned_docs/version-11.13.0 168, versioned_docs/version-11.14.0 188, versioned_sidebars 2, versions.json 1). 11.13.0 materialised is byte-identical to the original versioned_docs/version-11.13.0 across all 168 files, and versions.json and versioned_sidebars/version-11.13.0-sidebars.json are byte-identical to the originals. 11.14.0 materialised differs from the original docs/ in exactly two intended ways: 9 added files (5 rename stubs and 4 tombstone stubs, so 216 + 9 = 225) and 5 files whose only change is the +2 lines of the overlay: block the migration itself added to the source, with nothing removed. The channel's 225-file tree is identical to 11.14.0's except for the 5 redirect stubs, whose URLs correctly carry /next/ where the root-served version does not. All three generated sidebars are valid for their own version: every doc id resolves to a file that exists (6, 7 and 7 doc ids) and every autogenerated directory exists (20, 24 and 24 blocks). Observation worth keeping: the tombstone for mint/features/search/search landed at mint/features/search/index.mdx, because a file named after its own folder takes the folder's URL -- the third slug convention, firing on real content.

```sh
md5sum of every file in each materialised version, diffed against the same listing over the git archive 403b6b15 snapshot, plus a walk of each generated sidebar resolving every doc id and every autogenerated dirName against that version's own docs directory
```

**Verified** `md5sum comparison of each materialised version against the 403b6b15 snapshot, plus a walk of each generated sidebar resolving every doc id and autogenerated dirName against that version's own docs directory` → expected every deviation from the reference snapshot is one the migration intended, and each sidebar is valid for the version it belongs to, got Every deviation is accounted for: 168 of 168 files byte-identical for 11.13.0, versions.json and version-11.13.0-sidebars.json byte-identical, 9 added stubs and 5 overlay-block-only changes for 11.14.0, 5 /next/-scoped redirect stubs for the channel, and zero unresolved doc ids and zero missing autogenerated directories across all three sidebars. The shared-sidebar failure this check exists to catch was reproduced: applying 11.14.0's sidebar to 11.13.0's docs leaves 4 distinct autogenerated directories missing (atomic/examples, atomic/changelogs, atomic-angular/composables; 6 occurrences in total).

<sub>`9fcae372` · 2026-08-10T11:04:52Z · +9 −0 ~5 · owned by `materialize --check`</sub>

## 34. config — **pitfall**

Removed `import.meta` from the shared Docusaurus config. It cannot appear anywhere in a config file, not even in a branch that never executes, because Docusaurus loads configs through jiti, which transpiles them to CJS and evaluates them with `vm.Script`: the failure is a SyntaxError at compile time, not a missing value at runtime. It took two build failures to clear, because the second occurrence was inside an error message string. The surviving file states the constraint in a comment at docusaurus/docusaurus.config.base.js:16 and derives its own directory at line 20 as `typeof __dirname === "string" ? __dirname : process.cwd()`; grepping the config chain for `import.meta` now returns only that comment.

**Pitfall** `import.meta` in a Docusaurus config file is a compile-time SyntaxError, including in dead code, because jiti transpiles the config to CJS and runs it under `vm.Script`. Both occurrences had to be found by running the build; the second one hid in the text of an error message.

**Workaround** Used `__dirname`, which jiti's output provides, falling back to `process.cwd()` so a direct `import()` of the module still resolves its own directory.

**Detectable by** grep the whole config chain for `import.meta` before building -- the build error names the file and the line, but reads as a module-format problem rather than a jiti one, so it does not point at the rule.

<sub>`9fcae372` · 2026-08-10T12:09:33Z · +0 −0 ~1</sub>

## 35. config — **pitfall**

Replaced `require.resolve('docusaurus-lunr-search')` with the plain plugin name in the shared config. Splitting the config made the shared base an ESM module imported by the two thin configs, so `require` is not in scope there. Docusaurus resolves a plugin name against the site directory itself, which is what `require.resolve` was standing in for. docusaurus/docusaurus.config.base.js:79 now reads `'docusaurus-lunr-search'`.

**Pitfall** A `require.resolve()` call carried over from the CommonJS config broke the ESM shared base as soon as the two site configs imported it.

**Workaround** Passed the plugin name as a plain string and relied on Docusaurus resolving plugin names against the site directory.

**Detectable by** `ReferenceError: require is not defined in ES module scope` when loading the config; equivalently, grep the config chain for `require(` or `require.resolve(` once any config file is ESM.

<sub>`9fcae372` · 2026-08-10T12:09:33Z · +0 −0 ~1</sub>

## 36. config — mechanical

Factored the two site configs onto docusaurus.config.base.js (222 lines added), cutting docusaurus.config.js and docusaurus.internal.config.js down to a `createConfig({...})` call each; they differ only by `url`, `baseUrl` and `deploymentBranch`. The whole `docs` block -- `path`, `sidebarPath`, `includeCurrentVersion`, `lastVersion`, `versions` -- is destructured from the materialiser's manifest at docusaurus.config.base.js:54 and spread into the plugin options at lines 103-106, so neither config file states them and the two cannot disagree. Reported as verified by loading both configs and comparing their `docs.versions`: identical. Divergence from the briefing and from the commit message, both of which say nine lines each: docusaurus.config.js is 9 lines, docusaurus.internal.config.js is 10, the extra line being its `deploymentBranch: 'gh-pages'`.

```sh
wc -l docusaurus/docusaurus.config.js docusaurus/docusaurus.internal.config.js
```

<sub>`4205a812` · 2026-08-10T12:09:33Z · +1 −0 ~2 · owned by `materialize`</sub>

## 37. build — mechanical

Added the anchored ignore rules and the prebuild wiring. docusaurus/.gitignore gained 11 lines: 4 comment lines, a blank line, and the rules `/docs/`, `/versioned_docs/`, `/versioned_sidebars/`, `/versions.json`, `/.docs-overlay/` -- plus `/build-internal`, a sixth rule the briefing did not name. docusaurus/package.json gained `materialize` (`docs-overlay materialize --label next="Next 🚧"`), `verify` (`docs-overlay materialize --check`), `check` (`docs-overlay check`), and `prebuild`, `prebuild-internal` and `prestart`, all three calling `npm run materialize`, plus the two new devDependencies docs-overlay-cli and docs-overlay-docusaurus at ^0.1.0. The leading slashes matter: an unanchored `docs/` also matches content/docs/ and would hide every source file under it, which is a failure that looks like a disappearance rather than an error. Checked both ways: `git check-ignore -v docusaurus/docs/x.md` reports docusaurus/.gitignore:26 `/docs/`, the same command on docusaurus/content/docs/mint/index.mdx reports nothing, and `git ls-files docusaurus/content` counts 352 files today (351 at this commit, before content/README.md was added at f30a6185 -- the 351 the commit message states).

```sh
git check-ignore -v docusaurus/docs/x.md docusaurus/content/docs/mint/index.mdx; git ls-files docusaurus/content | wc -l
```

<sub>`4205a812` · 2026-08-10T12:09:33Z · +0 −0 ~2 · owned by `materialize`</sub>

## 38. build — **pitfall**

`--base-url /sba-mint/` passed on a Git Bash command line arrived as `C:/Program Files/Git/sba-mint/`, because MSYS rewrites arguments shaped like absolute POSIX paths. The value only ends up inside generated links, so nothing crashed: it poisoned the URL in ten generated pages. The guard now lives in the docs-overlay CLI at packages/cli/src/cli.ts:96, applied to the URL-valued flag that survived seq 39's removal of `--base-url`, namely `--route-base-path`, and is documented in packages/cli/README.md.

**Pitfall** MSYS argument conversion under Git Bash silently turned a URL path flag into a Windows filesystem path. Because the value is only interpolated into generated links, the run succeeded and wrote ten pages with a poisoned URL instead of failing.

**Workaround** The CLI refuses a value shaped like a Windows path and prints the per-flag form `MSYS2_ARG_CONV_EXCL='--route-base-path=' docs-overlay ... --route-base-path=/`, naming why `'*'` is the wrong answer: excluding everything also stops `--site-dir` being converted, which then reaches Node as an unresolvable /c/... path. It also points at running the command from a package.json script, where no conversion happens.

**Detectable by** reject any URL-valued flag whose value matches `^[A-Za-z]:[/\\]` -- the regex the CLI now applies is `/^[A-Za-z]:[/\\]|\\/`.

<sub>`4205a812` · 2026-08-10T12:09:33Z · +0 −0 ~2 · owned by `materialize`</sub>

## 39. build — **judgement**

Removed `baseUrl` from the adapter, so generated pages resolve it with `useBaseUrl` at build time instead of having an absolute URL baked in at generation time. Every generated path is now site-root-relative; the templates import `@docusaurus/useBaseUrl` and wrap each path in it (packages/adapters/docusaurus/src/templates.ts:76-87), and a unit test asserts the stub contains no `baseUrl:` and does contain `<Redirect to={useBaseUrl("/guide/new-api")} />`. Verified afterwards that both builds pass from a single materialisation, each rendering its own baseUrl.

**Decision** Remove `baseUrl` from the adapter entirely and let generated pages resolve it with `useBaseUrl` at build time, rather than baking an absolute URL in at generation time.

**Why** This site has two deployment targets with different baseUrl values. A baked-in URL means one materialisation per target -- 18 files rewritten on every switch -- and `materialize --check` in CI would then depend on which target ran last, so the same source tree would pass or fail depending on build order.

**Not taken** `Keep `--base-url` and materialise once per deployment target` · `Generate relative links instead of site-root-relative paths`

<sub>`4205a812` · 2026-08-10T12:09:33Z · +0 −0 ~2 · owned by `materialize`</sub>

## 40. build — **pitfall**

`export const target = useBaseUrl("...")` in the MDX stub template broke static generation for all 10 redirect stubs: an `export` in MDX is a module-level binding, so the hook ran outside the component and React rejected it. The build reported `static site generation failed for 10 paths` and named them. The template now calls the hook inline in each JSX expression, three times per page, with the reason recorded in a comment above it.

**Pitfall** Hoisting a React hook call into an MDX `export const` puts it at module level, outside any component, which React rejects -- so all 10 generated redirect stubs failed static site generation.

**Workaround** Called `useBaseUrl` inline in each JSX expression instead of hoisting it: same hook, same order, every render.

**Detectable by** SSG failing for exactly the set of generated pages, and for no others -- a failure set equal to the stub set points at the template rather than at the content.

<sub>`4205a812` · 2026-08-10T12:09:33Z · +0 −0 ~1 · owned by `materialize`</sub>

## 41. verify — verification

Both Docusaurus builds pass with `onBrokenLinks: 'throw'`, 620 HTML pages each, from a single materialisation: public with baseUrl /sba-mint/ and internal with /pages/Product/sba-mint/, each rendering its own into the generated stubs. 11.13.0 serves 167 doc routes. The root and /next/ serve identical doc route sets, 224 pages each; the root's 5 extra entries -- 11.13.0, 404, index, markdown-page, next -- are the site's own pages and version landings, not content. All 9 stub routes answer 200, and `unlisted: true` keeps the old slug out of the rendered sidebar while keeping its route: both halves confirmed. The only warnings are two pre-existing broken anchors. Re-counted from the two build directories still on disk: build and build-internal hold 620 .html files each; build/11.13.0 holds 167; build/next holds 224 and the root's atomic (75) + atomic-angular (104) + mint (44) + changelog.html sum to the same 224; 10 redirect stubs (5 per tree) and 8 tombstone stubs (4 per tree) are present, which is the 9 stubs per tree that the 9 stub routes refer to; the same stub renders href="/sba-mint/mint/configurations/customization/custom-json-files" under build and href="/pages/Product/sba-mint/..." under build-internal; and href="/sba-mint/mint/configurations/customization" appears in exactly 2 files, the two stub pages themselves, so no sidebar lists the old slug.

```sh
npm run build && npm run build-internal  # in docusaurus/, each preceded by prebuild -> npm run materialize; then: find build -name '*.html' | wc -l; find build-internal -name '*.html' | wc -l; find build/11.13.0 -name '*.html' | wc -l; find build/next -name '*.html' | wc -l; grep -rl 'This page moved to' --include='*.html' build; grep -rl 'This page was removed in' --include='*.html' build
```

**Verified** `npm run build && npm run build-internal in docusaurus/ (both with onBrokenLinks: 'throw', both after a single materialisation), then counting .html under build/ and build-internal/, counting them per version directory, listing the stub pages by their generated marker text, and grepping the old slug's href across the tree` → expected both deployment targets build from one materialisation with no broken link, the same page count, 167 doc routes for 11.13.0, identical doc route sets at the root and under /next/, every stub route reachable, each build rendering its own baseUrl into the stubs, and no sidebar listing a stub's old slug, got Both builds pass, 620 HTML pages each, from a single materialisation. 11.13.0: 167 doc routes. Root and /next/: 224 doc routes each, identical sets, plus 5 root-only entries (11.13.0, 404, index, markdown-page, next). 18 stub files on disk -- 10 redirect and 8 tombstone, i.e. 9 per tree -- all present as built pages. The same generated stub renders /sba-mint/... in build and /pages/Product/sba-mint/... in build-internal, so one materialisation serves both targets. The old slug /sba-mint/mint/configurations/customization appears in exactly 2 files, both of them the stub pages themselves, so `unlisted: true` kept the route and removed the sidebar entry. Only warnings are two pre-existing broken anchors.

<sub>`4205a812` · 2026-08-10T12:09:33Z · owned by `materialize --check`</sub>

## 42. wrapup — mechanical

Added docusaurus/content/README.md (123 lines) as the in-repo authority on the pipeline, rewrote docusaurus/README.md, which documented `yarn` while every workflow and both CI files use npm, and added a GitLab `docs-validate` job (54 lines in .gitlab-ci.yml) running `npm run verify`, `npm run check`, `npm run build` and `npm run build-internal` on any merge request whose changes touch docusaurus/**/* or .gitlab-ci.yml. Two things worth being precise about. The job publishes nothing: checked mechanically that .gitlab-ci.yml has no `pages` job, no `artifacts:` and no `environment:` -- the grep returns no match -- because publishing stays manual and stays on github.com via the two workflow_dispatch workflows. And neither GitHub workflow needed changing: f30a6185 touches nothing under .github/, deploy-public.yml and deploy-private.yml go through `npm run docs:ci` then `docs:build` / `docs:build-internal`, and those root script names are unchanged, the materialisation happening in `prebuild`.

```sh
grep -nE '^\s*(pages|artifacts|environment):' .gitlab-ci.yml; git show --stat --format='' f30a6185 -- .github; grep -n '"docs:' package.json
```

<sub>`f30a6185` · 2026-08-10T12:09:33Z · +1 −0 ~2</sub>

## 43. wrapup — **pitfall**

Two claims written into commit messages were wrong and were corrected by amending f30a6185 twice before pushing. First, "the site had no CI at all": false -- the two GitHub workflows do build and publish it, they are simply workflow_dispatch only (the `push:` trigger is commented out in both), so what was missing was validation on a merge request, which is what the message now says. Second, the whole network was described as unreachable after a single `git ls-remote` failure against the internal GitLab host, and `nslookup`'s exit code was then misread: it is 0 even when the output reports a non-existent domain. The public internet was reachable throughout, so the executable Docusaurus build reported as blocked was never blocked -- and that build is what found four real defects (seq 34, 35, 38 and 40).

**Pitfall** Two of the migration's own claims were false: that the documentation site had no CI, and that the network was down. The first understated what existed; the second declared a whole capability unavailable on the strength of one failed command against one internal host, and would have skipped the build that found four defects.

**Workaround** Amended both commit messages before pushing. Verify a network claim with a command whose output you read, not whose exit code you trust, and scope the claim to the host that actually failed.

**Detectable by** `nslookup` reporting NXDOMAIN while exiting 0 -- read its output, or use `getent hosts` or a real fetch against a public host before concluding anything about the network. For the CI claim: list the workflow files and read their `on:` triggers rather than inferring from pipeline behaviour.

<sub>`f30a6185` · 2026-08-10T12:09:33Z</sub>

## 44. build — **pitfall**

The user, installing the site for the first time since C5, hit `npm ci` refusing the tree in docusaurus/. Commit 4205a812 (`build(docs): generate the Docusaurus tree from content/ before every build`) added docs-overlay-cli and docs-overlay-docusaurus to docusaurus/package.json and left docusaurus/package-lock.json untouched, so the lockfile no longer described the manifest. This is a defect in the migration itself, not in the tooling. Nobody caught it because the plan's rule was "never run `npm install` in docusaurus/, `npm ci` is safe", and neither command was run between C5 and the user's install -- every build in this journal ran against an already-installed node_modules. Found by a human, not by any verification recorded here. Fixed in mint commit 071e2411 (seq 51).

```sh
npm ci  # in docusaurus/
```

**Pitfall** Declaring a devDependency without regenerating the lockfile in the same commit passes every check this migration ran: the builds used an already-installed node_modules, and the plan forbade `npm install` in docusaurus/ without requiring `npm ci` to be exercised even once. `npm ci` then refuses the tree outright -- and `npm ci` is the first thing a fresh clone and CI both do.

**Workaround** Regenerate the lockfile in the same commit as the manifest, with `npm install --package-lock-only` (seq 45), and prove it with `npm ci --dry-run`.

**Detectable by** `npm ci --dry-run` in the directory whose package.json changed. It fails with `npm ci can only install packages when your package.json and package-lock.json are in sync` and names the packages missing from the lock, so any change to a manifest should be followed by it.

<sub>`f30a6185` · 2026-08-10T12:45:00Z</sub>

## 45. build — measurement

Measured the two ways of bringing docusaurus/package-lock.json back in sync, because they are not interchangeable. The user's plain `npm install` re-resolved the tree and drifted unrelated transitives -- algoliasearch 5.55.0 -> 5.56.0, plus browserslist, autoprefixer, baseline-browser-mapping, algoliasearch-helper, and address 1.2.2 -> 2.0.3 -- 87 packages changed, i.e. a nine-package addition riding inside an 87-package dependency refresh in a documentation commit. `npm install --package-lock-only` added exactly the 9 packages of the new closure and moved no existing resolution: 108 lines added, 1 removed, 0 versions changed. Validated with `npm ci --dry-run`: resolves, 28 packages added, no conflict. docs-overlay-cli went to ^0.1.1 rather than ^0.1.0 because 0.1.0 was published without its dist/ and fails at ERR_MODULE_NOT_FOUND on dist/cli.js -- unusable, not merely older.

```sh
npm install --package-lock-only  # in docusaurus/, then npm ci --dry-run
```

<sub>`f30a6185` · 2026-08-10T12:52:00Z · +0 −0 ~1</sub>

## 46. sidebars — **pitfall**

The user started the dev server and found the nine generated stubs listed among the real documents -- "Moved to ..." entries, and "Search (removed in 11.14.0)". The adapter emits one page per routable slug that is not a page (a <Redirect> per renamed page, an explanatory page per tombstone; 9 of them on mint 11.14.0), each carrying `unlisted: true` to stay out of navigation. Docusaurus computes that in node_modules/@docusaurus/utils/lib/contentVisibilityUtils.js as `isUnlisted({frontMatter, env}) => (isProduction(env) && frontMatter.unlisted) ?? false`, so the flag is inert in development: `docusaurus build` hid every stub -- which is exactly why seq 41's verification passed, 620 pages with onBrokenLinks 'throw' -- while `npm start` showed all nine. The lesson is worth recording on its own: a verification run only in production mode cannot see this class of defect, and production is the mode that matters least to the person writing the docs. Found by a human running the dev server, not by any verification in this journal. One detail from disk that the briefing did not carry: the same module also honours SIMULATE_PRODUCTION_VISIBILITY=true, a third way to reproduce production visibility without a build.

```sh
npm start  # in docusaurus/
```

**Pitfall** `unlisted: true` is a production-only concept in Docusaurus, so every generated stub reappears in the development sidebar among the real documents, with its "Moved to ..." text as its label. A migration verified with `docusaurus build` alone will never see it, and the built site is correct while the authoring experience is wrong.

**Workaround** Do not rely on the flag: filter unlisted docs in your own `sidebarItemsGenerator` (`args.docs` carries `frontMatter`), and drop a category the filter empties, because Docusaurus refuses an empty category. Applied in mint's docusaurus/docusaurus.config.base.js as `withoutUnlisted()` (seq 48) and documented in the adapter's README under "Filter `unlisted` in your sidebar generator, do not rely on the flag", with the code.

**Detectable by** Run the dev server and read the sidebar, or inspect .docusaurus/docusaurus-plugin-content-docs/default/p/*.json for stub labels. NOT detectable by a production build -- that is the whole point of the pitfall.

<sub>`f30a6185` · 2026-08-10T13:05:00Z · owned by `materialize`</sub>

## 47. sidebars — **pitfall**

The unlisted filter removed 7 of the 9 stubs. The 2 survivors -- mint/configurations/customization and mint/features/search, the only two of the nine whose slug also names a directory -- are what pointed at the adapter rather than at the site configuration. stubPath() used to write <slug>/index.mdx whenever the slug also named a directory, on the belief that a file and a directory cannot share a name. They can: customization.mdx sits beside customization/, they differ by the extension. The special case was actively harmful, because Docusaurus reads index.mdx as the category index of its folder: the stub became the category's `link` and supplied its label, so the sidebar read "Moved to mint/configurations/customization/custom-json-files" where "Customization" belonged, and "Search (removed in 11.14.0)" where "Search" belonged. Worse, it made the obvious remedy blind -- a category index is no longer a doc item, so the withoutUnlisted() doc-item filter of seq 46 could never reach the two that mattered. Fixed in docs-overlay commit 223ade2 (PR #15, changeset proud-doors-sidebar): stubPath() always returns <slug>.mdx, and beside the directory a stub is an ordinary page -- same slug, same route, no category captured. 327 tests pass; the adapter's unit test was rewritten to "puts a stub beside a directory of the same name, never inside it as an index".

**Pitfall** An index.mdx generated for a slug that also names a directory is captured by Docusaurus as that folder's category index: it supplies the category's link and its label, so the stub's "Moved to ..." text replaces the folder's name in every sidebar. And because a category index is not a doc item, a filter over unlisted doc items cannot reach it -- the pitfall hides the fix for the pitfall above it.

**Workaround** stubPath() always returns <slug>.mdx. A file and a directory of the same name coexist, differing by the extension, so the stub sits beside the directory as an ordinary page: same slug, same route, no category captured.

**Detectable by** Assert that the materialiser writes no file named index.mdx: any stub landing at <dir>/index.mdx is this bug. From the rendered side, a sidebar category whose label begins with "Moved to" or contains "(removed in".

<sub>`f30a6185` · 2026-08-10T13:54:17Z · +1 −0 ~3 · owned by `materialize`</sub>

## 48. sidebars — mechanical

mint commit 6cbb37a7 (`fix(docs): keep generated stubs out of the sidebar in development`) landed the seq 46 workaround: 41 insertions, 3 deletions, one file. `withoutUnlisted(items, docs)` at docusaurus/docusaurus.config.base.js:69 builds a Set of the doc ids whose frontMatter.unlisted is true, filters `doc` and `ref` items out of the generated items, recurses into categories, and drops a category the filter empties rather than emitting it empty. It is wired at docusaurus.config.base.js:148-150 inside sidebarItemsGenerator, composed with the pre-existing capitalizeCategories(). The comment above it states the rule in its general form: this is not overlay-specific, any page marked unlisted stops appearing in a generated sidebar, which is what the flag reads as meaning.

```sh
git show --stat 6cbb37a7
```

<sub>`6cbb37a7` · 2026-08-10T13:57:06Z · +0 −0 ~1 · owned by `materialize`</sub>

## 49. verify — **pitfall**

My verification of the stubPath fix was worthless and the user caught it. The site consumes docs-overlay-docusaurus from npm -- ^0.1.0 in docusaurus/package.json at that point -- not from the monorepo, so a fix in the monorepo does not reach the site until it is published. I materialised with my local build and then ran `npx docusaurus start`, which skips the prestart script. The user ran `npm start`, whose prestart is `npm run materialize`, i.e. the published adapter, which rewrote customization/index.mdx as a stub and brought the bad category label straight back. The user reported "les folders expand/collapsed contiennent toujours la mention 'moved to xxx'" and was right: I had been measuring a tree that the real pipeline overwrote on its next run.

```sh
npm start  # in docusaurus/ -- runs prestart -> npm run materialize; NOT npx docusaurus start, which skips it
```

**Pitfall** Verifying through the underlying binary (`npx docusaurus start`) instead of the project's own script skips the `pre*` hook that regenerates the very inputs under test, so the verification measures a tree the real pipeline immediately overwrites. Compounded here by the site consuming the adapter from npm rather than from the monorepo, which makes the regenerated tree the *old* adapter's output.

**Workaround** Interim: copy the local packages/adapters/docusaurus/dist over docusaurus/node_modules/docs-overlay-docusaurus/dist in the site. This is disposable -- the next `npm ci` wipes it -- and the real fix is publishing the adapter and bumping the range. Then always verify through `npm start` / `npm run build`, so prestart/prebuild run.

**Detectable by** Whenever a `pre*` hook regenerates inputs, verify through the project's script, never the binary underneath it. Mechanically: compare the version of the adapter installed in node_modules against the version under test before trusting any result.

<sub>`6cbb37a7` · 2026-08-10T13:58:30Z · owned by `materialize --check`</sub>

## 50. config — **pitfall**

mint's lint-staged sends every staged *.json to oxfmt, and a lockfile is a *.json: oxfmt writes `"cpu": ["arm64"]` where npm writes the array across three lines. Neither committed lockfile is in oxfmt's shape -- `"cpu": [` alone on its line appears 46 times under docusaurus/ and 338 at the root -- so no lockfile had been staged since mint moved to oxfmt, and staging the regenerated one would have been the first time. Fixed preventively in mint commit 335dc1a7 (`chore(lint): never let the formatter own a generated lockfile`), one insertion adding `**/package-lock.json` to .oxfmtrc.json ignorePatterns: the same class as the existing docusaurus/content/** entry. Confirmed on disk at .oxfmtrc.json:23, sitting among the overlay's other generated-tree exclusions.

**Pitfall** A formatter configured by extension owns *.json, therefore it owns package-lock.json. A lockfile that goes through the hook comes out in a shape npm never produces; the next `npm install` writes npm's shape back, the next commit sends it to oxfmt again, and the file churns for as long as both tools keep their opinion.

**Workaround** Add `**/package-lock.json` to the formatter's ignorePatterns before a lockfile is ever staged. A generated file's shape belongs to the tool that generates it.

**Detectable by** grep the committed lockfile for `"cpu": [` alone on its line: if it is there, the formatter has never touched the file and staging it once will rewrite it wholesale. Equivalently, run the formatter over the lockfile in check mode and see whether it reports a change.

<sub>`335dc1a7` · 2026-08-10T14:00:38Z · +0 −0 ~1</sub>

## 51. build — **pitfall**

mint commit 071e2411 (`build(docs): lock the overlay tooling the site now depends on`) fixed the seq 44 defect, and its diff is unreadable for a reason that has nothing to do with the change. Before the commit, `git ls-files --eol` reported `i/crlf w/lf attr/text=auto eol=lf` for docusaurus/package-lock.json, and `i/crlf w/crlf` for the root one: the file predates .gitattributes declaring `text=auto eol=lf`. npm rewrote it as LF, so `git add` normalised the whole file to the policy the repository already states -- the commit shows 21130 insertions and 21023 deletions for a 108-line semantic change, and docusaurus/package.json shows 122 changed lines for a one-line version bump. Both figures confirmed on disk from `git show --stat 071e2411`. `git ls-files --eol` now reports `i/lf w/lf` for docusaurus/package-lock.json and docusaurus/package.json, while the root package-lock.json is still `i/crlf w/crlf`: the normalisation happened, scoped to the two files this commit touched.

```sh
git ls-files --eol docusaurus/package-lock.json docusaurus/package.json package-lock.json; git show --stat 071e2411
```

**Pitfall** A file that is CRLF in the index under `text=auto eol=lf` normalises in full the first time a generator rewrites it as LF, so a 108-line change lands as a 21000-line diff and the review value of the diff is gone. Nothing warns: the attribute has been correct all along, it simply had not been applied to that blob yet.

**Workaround** Isolate the generated file in its own commit and put the recipe for reading the real diff in the message: `git show HEAD:docusaurus/package-lock.json | tr -d '\r' > /tmp/before` then `tr -d '\r' < docusaurus/package-lock.json | diff /tmp/before -`.

**Detectable by** `git ls-files --eol <path>` before staging: `i/crlf` together with `attr/... eol=lf` means the next regeneration renormalises the whole file. The root package-lock.json still reads `i/crlf` today, so the same surprise is waiting there.

<sub>`071e2411` · 2026-08-10T14:02:11Z · +0 −0 ~2</sub>

## 52. build — **judgement**

Chose to let docusaurus/package-lock.json normalise to LF in the index rather than forcing CRLF back in with `git hash-object --no-filters` + `git update-index`, accepting the 21130/21023-line diff of commit 071e2411 for a 108-line change. The mitigation is in the commit's shape and message, not in the diff: the commit touches nothing but the lockfile and its manifest, and its message carries the two-command recipe to read the real change.

**Decision** Normalise the lockfile to LF in the index rather than preserving its CRLF with `hash-object --no-filters` + `update-index`.

**Why** `eol=lf` means every checkout is LF and npm writes LF, so normalising stops the churn once and for all, whereas preserving CRLF defers an identical 21000-line diff to whoever next regenerates the file -- and they will not have chosen it. The cost is one unreviewable diff, paid down by isolating the lockfile in its own commit and giving the `tr -d '\r'` recipe to read it.

**Not taken** `Preserve the index's CRLF with `git hash-object --no-filters` + `git update-index`, keeping a 108-line reviewable diff and leaving the renormalisation for whoever regenerates the file next` · `Renormalise every CRLF-in-index file in the repository in one dedicated commit, root package-lock.json included, so the policy and the index agree everywhere at once`

<sub>`071e2411` · 2026-08-10T14:02:11Z</sub>

## 53. verify — verification

Re-verified the episode through the project's own script -- so through prestart -> `npm run materialize` -- with the fixed adapter in place, which is the mistake of seq 49 not repeated. Reported: `files 622 planned - 4 written - 618 unchanged` and `removed 4 file(s)`; 0 index.mdx under versioned_docs and under .docs-overlay/current; no "Moved to" and no "(removed in" label in any sidebar of any of the 3 versions; the categories back to Customization and Search in all 3 versions; no previous/next navigation pointing at a stub; all 9 stub routes answering 200; and the production build unchanged at 620 pages with onBrokenLinks 'throw'. State on disk worth recording, since it moved after this run: docs-overlay 0.1.1 was released at 14:02:24Z (PR #16), docusaurus/node_modules/docs-overlay-docusaurus now reports version 0.1.1 with a dist mtime of 14:05:10Z, and mint's worktree carries an uncommitted bump of docs-overlay-docusaurus from ^0.1.0 to ^0.1.1 (1 line in the manifest, 4 in the lockfile) -- the disposable dist copy of seq 49 has been superseded by the published release, and that bump is not committed yet.

```sh
npm start  # in docusaurus/, then npm run build
```

**Verified** `npm start in docusaurus/ (so prestart -> npm run materialize regenerates the tree), then reading the dev sidebars of all three versions, counting index.mdx under versioned_docs and .docs-overlay/current, requesting the 9 stub routes, and npm run build for the production comparison` → expected the development sidebars match the production ones: no stub label anywhere, the two captured categories back to their own names, no stub reachable through previous/next, every stub route still answering 200, and the production build unchanged at 620 pages, got materialize reported 622 files planned, 4 written, 618 unchanged and 4 removed. 0 index.mdx under versioned_docs and under .docs-overlay/current. No "Moved to" or "(removed in" label in any sidebar of any of the 3 versions; categories back to Customization and Search in all 3. No previous/next navigation pointing at a stub. All 9 stub routes answer 200. Production build unchanged: 620 pages, onBrokenLinks 'throw'.

<sub>`071e2411` · 2026-08-10T14:10:00Z · owned by `materialize --check`</sub>

## 54. wrapup — measurement

Corrected an assumption the plan stated. The plan said SECURITY-NOTES.md justifies the byte-identity of docusaurus/package-lock.json across branches by the identity of the package.json files. It does not: `grep -ic lock SECURITY-NOTES.md` returns 0, while `grep -c brace-expansion` returns 8 -- the file discusses only the accepted brace-expansion advisory. The byte-identity was my own measurement, not a documented assertion, so no section of SECURITY-NOTES.md needed updating in C5, and none was.

```sh
grep -ic lock SECURITY-NOTES.md; grep -c brace-expansion SECURITY-NOTES.md
```

<sub>`071e2411` · 2026-08-10T14:20:00Z</sub>

## 55. build — **pitfall**

Corrected the cause stated in entries 51 and 52. Both said `git add` renormalises a CRLF file to LF because .gitattributes declares `text=auto eol=lf`, and that this is why docusaurus/package-lock.json produced a 21130/21023-line diff for a 108-line change. Measured directly, it does not: staging an edited file that is already i/crlf in the index leaves it i/crlf and shows 0 insertions / 1 deletion. text=auto converts on the way in only for a path new to the index, so a tracked CRLF file keeps its CRLF through any number of edits. The real cause is simpler and belongs to npm: `npm install --package-lock-only` rewrote the whole file with LF terminators in the working tree, and git stored the bytes that were there. The same measurement is what made the 112-file frontmatter edit safe to stage in one go -- verified on a CRLF file among them, 0/1 with the index still i/crlf. The conclusion of entry 52 survives its wrong premise: storing LF matches the eol=lf every checkout already produces and is what stops the churn, whereas forcing CRLF back with hash-object --no-filters would hand the same 21000-line diff to whoever regenerates the file next.

```sh
git add <a modified i/crlf file>; git diff --cached --numstat -- <it>; git ls-files --eol -- <it>
```

**Pitfall** Believing that `text=auto eol=lf` makes `git add` renormalise any CRLF file. It does not touch a path already in the index as CRLF, so a huge EOL diff on a tracked file means something rewrote the file, not that git converted it -- and the difference decides whether you go looking for a git workaround or for the tool that did the rewriting.

**Workaround** Measure before concluding: stage the file and read `git diff --cached --numstat` together with `git ls-files --eol`. If the index side is unchanged, git did nothing and the generator is responsible. hash-object --no-filters + update-index is only needed when git really would convert, which is when the path is new to the index.

**Detectable by** `git ls-files --eol <path>` before and after `git add`: the i/ column not moving proves git applied no conversion. A numstat of 0/1 on an edit that removed one line proves the same thing from the other side.

**Verified** `git add on one modified i/crlf content file and one i/lf one, then git diff --cached --numstat and git ls-files --eol on each, then git restore --staged` → expected if text=auto renormalised on add, the CRLF file would show a whole-file diff and flip to i/lf, got both files showed 0 insertions / 1 deletion; the CRLF one stayed i/crlf w/crlf and the LF one i/lf w/lf. No conversion took place.

<sub>`ed79b400` · 2026-08-10T14:52:00Z</sub>

## 56. sidebars — measurement

Measured the hand-maintained change badges before touching them, because the whole feature that replaced them rests on them being wrong. The site marked pages with a text badge drawn by a CSS `::after` from `sidebar_class_name` in the frontmatter: 67 `update`, 45 `new`, 15 `deprecated`, 1 `draft`. Cross-tabulated on 11.14.0 -- reality from the byte comparison against 11.13.0, tag from the frontmatter -- of the 57 pages the version added, 33 said `new`, 4 said `update`, 2 said `deprecated` and 18 said nothing; of the 123 it changed (that count includes the 4 tombstones), 63 said `update`, 4 said `new`, 9 said `deprecated` and 47 said nothing. 8 badges outright wrong, 65 missing, 96 right. And 13 files of 11.13.0 -- the base version, which has no predecessor to be new against -- carried a badge, 6 of them `new`. Nothing recomputes the field when a version is cut, so it cannot be kept true by hand. On disk today only the 16 authored tags remain, 15 `deprecated` and 1 `draft`, 5 under 11.13.0 and 11 under 11.14.0.

```sh
grep -rh "^sidebar_class_name:" docusaurus/content/docs | sed 's/.*: *//' | sort | uniq -c   # run before 499db5d7, then cross-tabulated against payload.changes in docusaurus/.docs-overlay/manifest.json
```

<sub>`ed79b400` · 2026-08-10T14:55:00Z · owned by `materialize`</sub>

## 57. sidebars — **judgement**

The user asked to convert the badges to bullets and, with them, to change what a mark means: a bullet only where this version added the page (green) or changed it (orange), derived rather than declared. Asked what should then happen to the two tags no diff can derive -- `deprecated` (15 pages) and `draft` (1) -- the user chose bullets for those too, red and hollow, keeping them authored in the frontmatter. Two further silences were decided here and written into the adapter's own documentation: the oldest version marks nothing, because every one of its pages is owned and a naive reading would call the whole tree new, which says nothing; and categories are left unmarked, because a category is not a document and marking one would raise whether it means its own index page or everything beneath it.

**Decision** Derive the `added` and `changed` marks from the overlay, keep `deprecated` and `draft` authored in the frontmatter, and render all four as one coloured bullet rather than a text badge -- with the oldest version marking nothing and categories left unmarked.

**Why** The measurement of entry 56 settles the derivable half: a field nobody recomputes when a version is cut decays, and 8 wrong plus 65 missing out of 169 is what that decay looks like after one release. The other half is not derivable at all -- "this page is going away" and "this page is unfinished" are editorial judgements about the future, and no comparison of two trees can produce them -- so they stay authored. Rendering both halves the same way is what keeps the sidebar readable: one visual language, and a dot rather than a word because at 24 nested categories the labels wrapped and "update" told a reader less than its own colour does.

**Not taken** `Keep `deprecated` and `draft` as text badges while the derived marks are bullets, leaving two visual languages in one sidebar` · `Drop `deprecated` and `draft` entirely, so the sidebar shows only what a diff can derive and the editorial status disappears from the navigation` · `Go on maintaining `sidebar_class_name: new` / `update` by hand, accepting the decay entry 56 quantified` · `Mark categories as well, and pick a meaning for it -- the category's own index page, or anything beneath it`

<sub>`ed79b400` · 2026-08-10T14:58:00Z · owned by `materialize`</sub>

## 58. sidebars — mechanical

Built the derivable half in docs-overlay: PR #17 (`feat(adapter): report what each version added and what it changed`, 642d376), merged as 78586b2 and released as `docs-overlay-docusaurus@0.2.0` / `docs-overlay-cli@0.2.0`. `materialize()` now returns `changes` -- per version, the doc ids the version added and the doc ids it changed -- computed at materialize.ts:196 from `!page.inherited && servedBefore !== undefined`, i.e. owning the file is the diff, and whether the predecessor served that slug decides added versus changed. Doc ids, because that is the space sidebars reference. A new `changeClassNames: { added, changed }` option hangs the classes on authored sidebar entries (new file packages/adapters/docusaurus/src/changes.ts, 81 lines, exported from index.ts); `--mark-added=<class>` and `--mark-changed=<class>` expose it on the CLI; the sets travel to the build in `payload.changes` in `.docs-overlay/manifest.json`; and the CLI prints a `changes` line summarising them. 7 new tests in materialize.test.ts, 334 passing at that point -- the suite reports 346 today, after PR #19 added slugs.test.ts. PR #17 also carried the prune fix of entry 63.

```sh
git log --oneline 78586b2^1..78586b2^2; git diff --stat 78586b2^1 78586b2
```

<sub>`ed79b400` · 2026-08-10T15:02:00Z · owned by `materialize`</sub>

## 59. sidebars — mechanical

mint commit fd3201fa (`feat(docs): show what each version added or changed as a sidebar bullet`) took the other half: 4 files, 129 insertions, 48 deletions. `changeMarks()` in docusaurus/docusaurus.config.base.js reads `payload.changes` and re-keys it by version **name** through `payload.versions`, because the manifest speaks version ids (`next`) and `sidebarItemsGenerator` speaks names (`current`) -- the mapping is read, not guessed. `markChanges(items, marks)` then hangs `overlay-added` / `overlay-changed` on autogenerated `doc` and `ref` items, recursing into categories and appending to any existing class. custom.css draws a dot instead of a word: success green for added, warning orange for changed, danger red for `deprecated`, hollow for `draft`. Two mechanisms, and that is not a design choice: authored entries exist at materialisation time, so the adapter marks those, while an `autogenerated` block's items do not exist until Docusaurus expands the directory during the build. On mint's sidebars.js that split is 24 `type: 'autogenerated'` blocks against 6 authored doc items -- `index`, `changelog`, `atomic/intro`, `changelog`, `atomic-angular/intro`, `atomic-angular/changelog` -- which are exactly the pages that change every release. Also in this commit: `verify` became `npm run materialize -- --check` instead of repeating the flag list, because `--check` compares against what those flags produce and two lists that could disagree would report the tree as out of date for no reason.

```sh
git show --stat fd3201fa
```

<sub>`fd3201fa` · 2026-08-10T15:08:00Z · +0 −0 ~4 · owned by `materialize`</sub>

## 60. sidebars — **pitfall**

The derived mark never reached a page that carries a frontmatter class, and the reason is one line of Docusaurus. `plugin-content-docs/lib/props.js:25` builds each sidebar link with `className: frontMatter.sidebar_class_name ?? item.className`, so a page with `sidebar_class_name` **discards** whatever class the sidebar item had, the generator's derived mark included. There is no composing the two from a `sidebarItemsGenerator`, because the generator's output is the `item` that loses. Diagnosed by noticing that all 11 entries with `className="deprecated"` in the rendered 11.14.0 sidebar were missing their derived mark -- a systematic pattern rather than a coincidence. Accepted rather than worked around: the precedence is the one to want, since a reader needs to know a page is going away more than that it was edited. So mint's CSS carries no `.deprecated.overlay-*` rule and a comment states that the selector could never match.

```sh
sed -n '25p' docusaurus/node_modules/@docusaurus/plugin-content-docs/lib/props.js
```

**Pitfall** A `sidebarItemsGenerator` cannot add a class to a page that has `sidebar_class_name` in its frontmatter. props.js prefers the frontmatter value and throws the item's away -- `??`, not a concatenation -- so a derived mark is silently dropped on exactly the pages an author has already labelled.

**Workaround** Accept the precedence and document it, which is what was done here: no CSS rule combining the two classes, and a comment saying why the selector cannot match. The alternative, if both marks really must show, is to move the editorial status out of `sidebar_class_name` into `sidebar_custom_props` -- 16 files here -- so the generator owns `className` alone and can compose.

**Detectable by** Count the `overlay-*` marks in the rendered sidebar against the manifest's `added` and `changed` sets: the shortfall is exactly the pages carrying a frontmatter class. Equivalently, list the pages with `sidebar_class_name` and intersect them with the two sets before believing any mark is missing for another reason.

<sub>`fd3201fa` · 2026-08-10T15:09:00Z · owned by `materialize`</sub>

## 61. sidebars — **pitfall**

mint commit 499db5d7 (`refactor(docs): drop the change tags the overlay now derives`) removed `sidebar_class_name: new|update` from 112 files -- 45 `new` and 67 `update`, across 11.13.0 and 11.14.0 -- and the removal had to leave every other byte alone, since the migration's central claim is that content bytes did not move. It took three attempts. Attempt 1 located the frontmatter with `text.indexOf("\n---")` and removed the line with a regex requiring a trailing newline; the field is very often the frontmatter's **last** key, so the regex matched 2 files of 112. Attempt 2 filtered lines but left both the previous line's terminator and the block's own, inserting a blank line: `git diff --numstat` reported `1 1` instead of `0 1` on every file. Attempt 3 still used `indexOf("\n---")`, which cuts a CRLF terminator in half -- the `\r` stays inside the block and looks like part of the field's line, so removing it also took the previous line's terminator and rewrote it from CRLF to LF; 25 files showed `1 2`, and those 25 were exactly the ones git reported as mixed line endings. The version that worked splits the whole file into lines that each keep their own terminator, finds the two fence lines, drops exactly one line between them and rejoins. All 112 then showed 0 insertions / 1 deletion, and the commit's diffstat is `112 files changed, 112 deletions(-)`. Side observation worth keeping: after the removal those 25 mixed-EOL files became uniformly CRLF -- their only LF line was the tag, written by an editor that did not follow the file it was editing, which is its own evidence the badges were maintained one page at a time.

```sh
git show --stat 499db5d7 | tail -1; git diff --numstat   # expected 0 1 on every file, never 1 1 or 1 2
```

**Pitfall** Deleting one frontmatter line byte-safely is three traps in a row. `indexOf("\n---")` cuts a CRLF terminator in half, so the stranded `\r` makes the removal eat the previous line's terminator and silently convert it to LF. A regex anchored on a following newline misses the field whenever it is the block's last key -- which it usually is. And filtering lines without deciding who owns the terminator leaves a blank line where the field was.

**Workaround** Split the file into lines that each carry their own terminator, locate the two `---` fences among those lines, drop exactly one element between them, and join with no separator. No YAML round-trip, no reformatting, no assumption about which terminator the file uses.

**Detectable by** `git diff --numstat` over the whole batch after removing one line from each file: every path must read `0 1`. `1 1` means a blank line was left behind, `1 2` means a terminator was rewritten -- and `git ls-files --eol` on those paths will show them as the CRLF ones.

<sub>`499db5d7` · 2026-08-10T15:10:00Z · +0 −0 ~112</sub>

## 62. prune — mechanical

With the tags gone, `docs-overlay prune` found 3 files under 11.14.0 byte-identical to what they inherit from 11.13.0: `atomic-angular/components/did-you-mean.md`, `atomic-angular/stores/principal.md`, `atomic-angular/stores/selection.md`. The tag was the entire difference -- those pages had not been edited for the release at all, only badged as if they had. Removed in mint commit 3a03b095 (`refactor(docs): prune the overrides that existed only to carry a tag`), 3 files changed, 111 deletions. The three URLs answer exactly the same bytes by inheritance, and the pages correctly stop being reported as changed in 11.14.0: 119 sidebar-visible changes before, 116 after. This is the overlay paying for itself in the small -- a hand-maintained badge had been inflating the very diff it was supposed to describe.

```sh
docs-overlay prune --dry-run; git show --stat 3a03b095
```

<sub>`3a03b095` · 2026-08-10T15:11:00Z · +0 −3 ~0 · owned by `prune`</sub>

## 63. prune — **pitfall**

`docs-overlay prune` announced work it had not done. It printed `removed <path>` for every candidate and then ran a single `git rm` at the end. `git rm` refuses a file with staged or local changes -- which is exactly the state every freshly-redundant file is in, because the edit that made it redundant is right there in the worktree -- so the first real run of entry 62 printed "removed" for three files and then failed, having removed none. Fixed in docs-overlay PR #17: the list is now printed without a verb, because at that point it is a finding rather than an outcome; the count is reported only after the removal succeeds (`removed N file(s); those slugs are now served by inheritance.`); and the failure message names both remedies instead of only the second -- commit what you have and run it again, or `--no-git` to unlink without staging the removal.

```sh
docs-overlay prune   # with the redundant files still uncommitted in the worktree
```

**Pitfall** Reporting per-item outcomes before a single batch operation runs. The output claims the work is done, then the batch fails and nothing happened -- and the failure mode is not rare here, it is the normal mid-migration state, since `git rm` refuses precisely the dirty files a prune has just created.

**Workaround** Print findings and outcomes in different voices: the candidate list carries no verb, and the count is emitted after the operation returns. When it fails, name every remedy -- commit first, or `--no-git`.

**Detectable by** Run the command with the candidate files uncommitted, which is the state it is actually used in, and compare its output against `git status`. Any line claiming a removal that `git status` does not show is this bug.

<sub>`3a03b095` · 2026-08-10T15:12:00Z · owned by `prune`</sub>

## 64. sidebars — **pitfall**

The adapter computed identifiers Docusaurus never uses for every number-prefixed page. `mint/tutorial/040_filters.md` is the doc `mint/tutorial/filters`, served at that URL, because `DefaultNumberPrefixParser` strips a leading number from **every** path segment, directories included. `docIdOf` only dropped the extension and `docusaurusSlugify` stripped nothing, so all 11 prefixed tutorial pages were named wrongly on both axes. The visible symptom was one page no bullet could reach. The real one is quieter: `pruneMissing()` removes a sidebar reference whose doc it cannot find among the version's doc ids, so an **authored** entry naming a prefixed page would have been silently pruned out of the navigation, on a site that had done nothing wrong. It survived here only because the tutorial is reached through an `autogenerated` block, which resolves by directory. Fixed in docs-overlay PR #19 (2c501e2), released as `docs-overlay-docusaurus@0.2.1`, taken by mint in 10c10d7a. Both patterns were copied from the plugin rather than approximated, including the second one's job of *refusing* to strip: `/^\d+[-_.]\d+/` protects `7.0-notes.md` and `2021-11-release.md`, because a version and a date both look like a number followed by a separator. `id` frontmatter is honoured too, replacing the file-name part of a doc id and only that part. The asymmetry a reimplementation gets wrong, now pinned by tests: `isCategoryIndex` compares **raw** names on both sides (`path.parse(source).name` against the unstripped directory) while the URL it emits is stripped, so `020_guide/020_guide.md` is a category index served at `/guide` and `020_guide/guide.md` is not one and is served at `/guide/guide`. Worth recording as a pattern: this was the **third** defect in this adapter found by running it against a real 620-page site rather than by reading it, after the stub-as-category-index and the production-only `unlisted`. All three were places where the adapter reimplemented a Docusaurus convention from the documentation instead of from the plugin's source.

```sh
git show 2c501e2; git show --stat 10c10d7a
```

**Pitfall** Reimplementing a framework convention from its documentation instead of its source. Docusaurus strips number prefixes from every path segment, and it also refuses to strip when the number is followed by another number -- a version or a date. An adapter that models neither computes doc ids and slugs the framework never uses, and the loud symptom (a missing mark) is far less serious than the quiet one: `pruneMissing()` drops an authored sidebar entry whose doc id it cannot resolve.

**Workaround** Copy the plugin's own patterns, both of them, rather than approximating: strip `^\d+[-_.]` per segment, and do not strip when `^\d+[-_.]\d+` matches. Keep `isCategoryIndex` comparing raw names even though the emitted URL is stripped -- stripping before comparing invents a category index Docusaurus does not see.

**Detectable by** Compare the adapter's doc ids against the ones the built site actually serves, on a tree that has number-prefixed files. More cheaply: any `docs-overlay` diagnostic about a pruned sidebar reference, or a page that carries no derived mark while the manifest says the version changed it, points straight at an identifier mismatch.

<sub>`10c10d7a` · 2026-08-10T15:15:00Z · +0 −0 ~2 · owned by `materialize`</sub>

## 65. build — **pitfall**

Twice, `npm ci` in `docusaurus/` died with `EPERM: operation not permitted, unlink ... lightningcss-win32-x64-msvc/lightningcss.win32-x64-msvc.node`. The file is a native `.node` DLL still loaded by a running Docusaurus dev server, and Windows will not unlink a mapped image. It fails **after** deleting part of `node_modules`, so the tree is left broken and the running server with it -- the second failure was worse than the first, because by then the reinstall was the recovery step. A `pkill -f 'docusaurus start'` from Git Bash reported success without actually killing anything; identifying the processes through `Get-CimInstance Win32_Process` and stopping them with `Stop-Process` did.

```sh
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'docusaurus' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

**Pitfall** `npm ci` deletes `node_modules` before repopulating it, so a native module held open by a running process fails the install halfway and leaves no working tree behind. On Windows this is an EPERM on unlink, not a warning, and the dev server that caused it is now running against a half-deleted dependency tree.

**Workaround** Stop every dev server before any install. On Windows do it through `Get-CimInstance Win32_Process` plus `Stop-Process` and verify the process is gone -- a `pkill` from Git Bash matched nothing and still exited as though it had worked.

**Detectable by** Read the path in the EPERM message and find the process holding it (`Get-CimInstance Win32_Process`, or Handle/Process Explorer). Preventively: refuse to run an install while a process whose command line contains `docusaurus start` exists.

<sub>`10c10d7a` · 2026-08-10T15:20:00Z</sub>

## 66. verify — verification

Final state of the episode, verified from a clean `npm ci` with `docs-overlay-docusaurus@0.2.1` and through the project's own scripts, so `prestart`/`prebuild` ran the materialiser -- the mistake of entry 49 not repeated. Both targets build 620 pages under `onBrokenLinks: 'throw'`; the materialiser is idempotent; the derived marks are present in 11.14.0 and absent from the base version and the empty channel; and every page the version added or changed is accounted for, the 12 unmarked ones by the two deliberate rules of entries 57 and 60 rather than by accident. Confirmed again on disk while writing this: `docusaurus/.docs-overlay/manifest.json` reports `11.13.0 +0/0`, `11.14.0 +57/116`, `next +0/0`; nothing under `.docs-overlay/` or `versioned_docs/` is tracked by git; and `content/` is not ignored.

```sh
npm ci && npm run build && npm run build-internal && npm run materialize   # in docusaurus/
```

**Verified** `clean npm ci in docusaurus/, then npm run build and npm run build-internal, then npm run materialize a second time for idempotence, then counting overlay-added / overlay-changed marks in the rendered sidebar of each of the three versions and intersecting them per doc with payload.changes, plus git ls-files over the generated trees and git check-ignore on content/` → expected 620 pages on both targets; a second materialisation writing nothing; marks only in 11.14.0; and every unmarked page among the version's additions and changes explained by a rule rather than by a bug, got npm run build and npm run build-internal: 620 pages each, onBrokenLinks 'throw'. Materialiser: 622 planned - 0 written - 622 unchanged, i.e. idempotent. CLI reported `changes    11.14.0: +57 added - 116 changed`. Marks in the rendered sidebars: 11.13.0 -> 0 added / 0 changed; 11.14.0 -> 55 added / 107 changed; next -> 0 / 0. Per-doc: 55 of 57 additions and 106 of 116 changes carry a mark; the 12 that do not are the 10 pages also marked `deprecated` (frontmatter precedence, entry 60) and the 2 category indexes atomic-angular/components/drawer/drawer and atomic-angular/components/labels/labels (left unmarked deliberately, entry 57). No generated file tracked by git; content/ not ignored.

<sub>`10c10d7a` · 2026-08-10T15:35:00Z · owned by `materialize --check`</sub>

