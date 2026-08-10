# Steps a tool can take unattended

Derived from every `scriptable: true` entry, grouped by the command that owns it.

## `(no command — migration-specific)`

- **2** (setup) Created worktree C:/dev/mint-release-11.14.0 on new branch chore/docs-overlay-migration from origin/release/11.14.0 (403b6b15). The three pre-existing worktrees all sit on origin/develop (01d246f1), so none of them could host work targeting the release branch.
  ```sh
  git worktree add C:/dev/mint-release-11.14.0 -b chore/docs-overlay-migration origin/release/11.14.0
  ```
- **7** (setup) `git hash-object --no-filters --stdin-paths` failed on every absolute path fed through stdin, reporting files that plainly existed as missing. MSYS path translation applies to command-line arguments only, not to stdin, so git.exe received /c/Users/... verbatim.
  ```sh
  cut -f2 want.txt | sed "s#^#$(cygpath -m "$REF")/#" | git hash-object --no-filters --stdin-paths
  ```
- **12** (setup) Entries 12 to 25 were written together immediately after C4, so they share one timestamp; each carries the repo_head of the commit its step produced, not the branch head at writing time. This entry records the hook situation: core.hooksPath is .husky/_, a directory husky only creates during npm install, and this worktree has no node_modules, so .husky/_ does not exist and git runs no hooks at all. Verified by a throwaway commit that completed without lint-staged running.
  ```sh
  git config core.hooksPath  # .husky/_ ; test -d .husky/_  # absent
  ```
- **25** (wrapup) Content migration complete. git ls-files docusaurus/content counts 351 files: 11.13.0 = 169 (168 pages + sidebars.json), 11.14.0 = 181 (119 overrides + 57 additions + 4 tombstones + sidebars.json), next = 1 (.gitkeep). Divergence from the briefing: the pre-migration total is 575, not 576 -- git ls-tree -r --name-only 403b6b15 -- docusaurus/docs docusaurus/versioned_docs docusaurus/versioned_sidebars docusaurus/versions.json gives 216 + 168 + 188 + 2 + 1 = 575, which matches the earlier census of 208 CRLF + 366 LF + 1 empty. Against 575 the reduction is 224 files, 39%. Not done yet: the site does not build, because versions.json, versioned_docs/ and versioned_sidebars/ are gone and nothing generates them yet.
  ```sh
  git ls-files docusaurus/content | wc -l
  ```
- **26** (wrapup) Recorded a structural constraint of this setup: the journal lives in the docs-overlay repository while the migration was performed in sba-mint, so no single commit can carry both a step and the entry describing it.
  ```sh
  node scripts/check-journal.mjs notes/migrations/mint-11.14.0/journal.jsonl --repo /c/dev/mint-release-11.14.0
  ```

## `migrate docusaurus`

- **1** (setup) Entries 1 to 8 were written together at the end of phase 0a, not one per step, because the journal and its validator did not exist yet when those steps ran. Every figure in them was re-derived from a command re-run at write time, so none is remembered. From entry 9 onward the migration-scribe subagent writes one entry per step, at the step.
- **3** (setup) `git worktree add -b <topic> origin/release/11.14.0` set the new branch's upstream to origin/release/11.14.0. Detached it, so no push can reach the protected release branch by accident.
  ```sh
  git branch --unset-upstream
  ```
- **8** (detect) A sibling worktree on develop holds docusaurus/next/ as a 20-directory skeleton containing zero files, untracked. It does not exist on release/11.14.0, so this migration is not blocked by it, but the same debris would make `git mv docs content/docs/next` fail halfway through on that branch while `git status` reported a clean tree.
  ```sh
  git status --porcelain  # clean, yet C:/dev/mint-11.14.0/docusaurus/next exists with 20 directories and 0 files
  ```
- **17** (setup) Created the annotated tag docs/frozen-11.14.0-snapshot on 403b6b15 before dropping the frozen snapshot; its message records the 188 files, the drift figures and the git checkout line that recovers the tree. It could not be pushed: this environment has no network, DNS resolution of gitlab.chapsvision.in fails, so pushing it is left to the operator. The blobs survive in history regardless, so the tag is a convenience marker and an intent record, not the only safety net.
  ```sh
  git tag -a docs/frozen-11.14.0-snapshot 403b6b15 -m '<message>'
  ```

## `migrate docusaurus / classify`

- **10** (classify) Ran the rename heuristic with the weights the engine will ship (0.60*content + 0.20*stem + 0.15*path + 0.05*title, accept at 0.75 with a 0.15 margin, ask from 0.45). mint/configurations/customization -> mint/configurations/customization/custom-json-files scored 0.700 and was routed to a human although both files are 397 lines (wc -l on both reference copies) with content 1.00 against a runner-up at 0.22. Divergence from the briefing, checked with diff: the frontmatter title changed (Via Sinequa Admin -> Custom Json files) and the child also adds sidebar_class_name: update, while the parent carries one trailing empty line the child does not -- the body lines are identical, but title is not the only difference.
  ```sh
  node classify-prototype.mjs <ref>/v11.13.0 <ref>/docs
  ```
- **11** (classify) Final classification of the 9 vanished slugs after both corpus-driven rules (the existed-in-parent disqualifier and the identical-body branch of entry 10): 5 automatic renames (mint/configurations/filters 0.950, logos-and-title 0.950, routes 0.794, customization 0.700 via the identical-body branch, mint/how-to/localization 0.792), 2 silent tombstones (mint/features/search/components/record-card, confirmed 0 bytes, and mint/features/search/search-all, best candidate 0.150), and 2 asks that need a replacedBy answer rather than a rename target (atomic/changelog, mint/features/search/search). The existed-in-parent disqualifier is what demoted atomic/changelog -> changelog (stem 1.00, title 1.00, but content 0.00 and the target already served by 11.13.0) from a confident wrong rename to a question. Divergence from the briefing: the same disqualifier does hit mint/search-all-layout, verified byte-identical across the two trees (blob 7ea576d7), but it does not appear among search-all's three scored candidates in classify-output.txt and search-all's recorded verdict is a silent tombstone, not a question. recursive: true applies nowhere on this corpus -- mint/features/search/components/ holds exactly one page, so a recursive tombstone would be equivalent to a plain one, and mint/features/search/ loses three pages while gaining data-flow, so recursing there would tombstone a live page.
  ```sh
  node classify-prototype.mjs <ref>/v11.13.0 <ref>/docs  # output captured in classify-output.txt
  ```

## `migrate docusaurus / config`

- **13** (config) Excluded docusaurus/content/**, the generated trees (versioned_docs/, versioned_sidebars/, versions.json) and docusaurus/.docs-overlay/** from oxfmt and oxlint, by extending ignorePatterns in .oxfmtrc.json and .oxlintrc.json. Reason: lint-staged passes every staged *.json to oxfmt, which writes in place and forces endOfLine: lf, which would rewrite the pinned sidebars.json whose bytes must stay identical to the snapshot it is moved from. Scoped deliberately so docusaurus.config*.js and the rest of the site keep being formatted.

## `migrate docusaurus / detect`

- **4** (detect) Line-ending census of the three doc trees on release/11.14.0: 208 files are stored with CRLF in the index (51 in docs/, 123 of the 168 in versioned_docs/version-11.13.0, 34 in versioned_docs/version-11.14.0), 366 with LF, and 1 with neither (mint/features/search/components/record-card.mdx is 0 bytes). For every file the index and worktree endings agree, so the worktree bytes are the blob bytes.
  ```sh
  git ls-files --eol -- docusaurus/docs docusaurus/versioned_docs docusaurus/versioned_sidebars docusaurus/versions.json | awk -F'\t' '{split($1,a," "); print a[1], a[2]}' | sort | uniq -c
  ```
- **5** (detect) Parsed `git ls-files --eol` by whitespace column and got the literal string "eol=lf" where a path was expected, which produced a nonsense per-tree breakdown. The attribute column contains a space, so the path is only reliably reachable after the TAB.
  ```sh
  git ls-files --eol -- docusaurus/docs | awk -F'\t' '{split($1,a," "); if(a[1]=="i/crlf") print $2}'
  ```

## `migrate docusaurus / move`

- **14** (move) The first attempt moved both doc trees in one commit. It was content-correct, both destinations verified byte-identical to the reference, but the diff was misleading: 40 files are byte-identical across the two source trees, so git's rename detection paired them across trees and reported renames such as docusaurus/{docs => content/docs/11.13.0}/atomic-angular/components/aggregation.md for a file that actually came from versioned_docs/version-11.13.0. Measured at 80 mislabelled renames out of 385 (169 + 216).
  ```sh
  git diff --cached -M --summary  # on the discarded single-commit staging
  ```
- **15** (move) git mv of docusaurus/versioned_docs/version-11.13.0 to docusaurus/content/docs/11.13.0, and of versioned_sidebars/version-11.13.0-sidebars.json to content/docs/11.13.0/sidebars.json. 169 renames, all at R100, 0 insertions, 0 deletions, 0 files modified, 0 cross-tree pairings.
  ```sh
  git mv docusaurus/versioned_docs/version-11.13.0 docusaurus/content/docs/11.13.0 && git mv docusaurus/versioned_sidebars/version-11.13.0-sidebars.json docusaurus/content/docs/11.13.0/sidebars.json
  ```
- **16** (move) git mv of docusaurus/docs to docusaurus/content/docs/11.14.0, plus a created docusaurus/content/docs/next/.gitkeep. 216 renames, all at R100, 1 creation, 0 insertions, 0 deletions.
  ```sh
  git mv docusaurus/docs docusaurus/content/docs/11.14.0 && git add docusaurus/content/docs/next/.gitkeep
  ```
- **18** (move) git rm of docusaurus/versioned_docs/version-11.14.0 (188 files), docusaurus/versioned_sidebars/version-11.14.0-sidebars.json and docusaurus/versions.json: 190 deletions, no additions, so rename detection has nothing to pair and the diff cannot be misread.
  ```sh
  git rm -r -q docusaurus/versioned_docs/version-11.14.0 docusaurus/versioned_sidebars/version-11.14.0-sidebars.json docusaurus/versions.json
  ```
- **24** (detect) Corrected my own earlier claim from the line-ending census, that every git add of one of the 208 CRLF files rewrites CRLF to LF. Two experiments on the same file settled it: copying to a new path then git add yields i/lf and git warns that CRLF will be replaced by LF the next time git touches the file, whereas modifying the existing path then git add keeps i/crlf with a diff of exactly the changed lines. text=auto skips normalisation for a path the index already holds with CRLF, which is why git add --renormalize exists as a separate flag.
  ```sh
  git ls-files --eol <path>  # before and after staging, on both a new and an existing path
  ```

## `migrate docusaurus / prune`

- **9** (detect) Computed the overlay diff between the reference copies of versioned_docs/version-11.13.0 (parent) and docs/ (child, to be promoted to 11.14.0), keyed on slugs -- path minus extension -- and comparing raw bytes for identity: parent 168 slugs, child 216 slugs, 159 shared of which 40 byte-identical (to be pruned; prune-list.txt holds exactly 40 paths) and 119 overrides, 57 added, 9 gone. Arithmetic check that the folded newest version reproduces today's tree: 168 - 9 + 57 = 216. Keying on slugs rather than filenames is what makes atomic/api/suggest.mdx -> atomic/api/suggest.md a single override instead of a deletion plus an addition; both files were confirmed present in the snapshot, one per side. Every figure matches classify-output.txt lines 1-3.
  ```sh
  node classify-prototype.mjs <ref>/v11.13.0 <ref>/docs
  ```
- **19** (prune) git rm of the 40 files in content/docs/11.14.0 that are byte-identical to what they inherit from 11.13.0, so 11.14.0 now serves the 11.13.0 copy for those slugs. The list was regenerated from the two committed trees, keyed on slug and compared on raw bytes, and cross-checked equal to the prune-list.txt recorded earlier. This step has to be a command rather than a stored list, because a backport onto another branch has a different docs/ tree and therefore a different set.
  ```sh
  git rm -q $(cat prune-list.txt)  # list regenerated from the two committed trees, compared on raw bytes
  ```

## `migrate docusaurus / tombstone`

- **23** (rename) Wrote the overlay directives: overlay.renamedFrom into the frontmatter of the 5 renamed files, each coming out at exactly +2/-0; 4 bare overlay.deleted tombstones, added as new files at +7 each; and content/docs/11.14.0/sidebars.json, 258 lines, a round-trip-verified JSON serialisation of sidebars.js. 10 files, 296 insertions, 0 deletions. 11.14.0 needs its own navigation because the inherited 11.13.0 sidebar lists atomic/changelog, which this version tombstones, and lacks the categories this version adds; next/ ships none and inherits this one.

## `migrate docusaurus / verify`

- **6** (setup) Took the pre-migration reference snapshot of docs/, versioned_docs/version-11.13.0, versioned_docs/version-11.14.0, versioned_sidebars/, versions.json and sidebars.js into a scratch directory outside the repository, then proved the copy is bit-exact by hashing all 574 copied files with --no-filters and comparing against the index OIDs.
  ```sh
  git hash-object --no-filters --stdin-paths < refpaths.txt  # compared against `git ls-files -s`
  ```

