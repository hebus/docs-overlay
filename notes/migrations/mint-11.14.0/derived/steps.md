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
- **29** (build) The adapter's architecture test scans its own sources for forbidden imports and flagged templates.ts for importing @docusaurus/Redirect and @docusaurus/Head. Those imports are inside template literals: they belong to the MDX the stubs emit, and are resolved by the site, not by this package.
  ```sh
  npx vitest run packages/adapters/docusaurus
  ```
- **30** (build) tsc -p packages/adapters/docusaurus failed on the architecture test with Cannot find name 'node:fs': Node's ambient types are not in that project's scope. Moved the test to packages/adapters/docusaurus/test/ with its own tsconfig declaring types: ["node"], mirroring packages/core/test/, and registered that project in the root typecheck script. npm run typecheck now runs five tsc projects and exits clean.
  ```sh
  tsc -p packages/adapters/docusaurus
  ```
- **34** (config) Removed `import.meta` from the shared Docusaurus config. It cannot appear anywhere in a config file, not even in a branch that never executes, because Docusaurus loads configs through jiti, which transpiles them to CJS and evaluates them with `vm.Script`: the failure is a SyntaxError at compile time, not a missing value at runtime. It took two build failures to clear, because the second occurrence was inside an error message string. The surviving file states the constraint in a comment at docusaurus/docusaurus.config.base.js:16 and derives its own directory at line 20 as `typeof __dirname === "string" ? __dirname : process.cwd()`; grepping the config chain for `import.meta` now returns only that comment.
- **35** (config) Replaced `require.resolve('docusaurus-lunr-search')` with the plain plugin name in the shared config. Splitting the config made the shared base an ESM module imported by the two thin configs, so `require` is not in scope there. Docusaurus resolves a plugin name against the site directory itself, which is what `require.resolve` was standing in for. docusaurus/docusaurus.config.base.js:79 now reads `'docusaurus-lunr-search'`.
- **42** (wrapup) Added docusaurus/content/README.md (123 lines) as the in-repo authority on the pipeline, rewrote docusaurus/README.md, which documented `yarn` while every workflow and both CI files use npm, and added a GitLab `docs-validate` job (54 lines in .gitlab-ci.yml) running `npm run verify`, `npm run check`, `npm run build` and `npm run build-internal` on any merge request whose changes touch docusaurus/**/* or .gitlab-ci.yml. Two things worth being precise about. The job publishes nothing: checked mechanically that .gitlab-ci.yml has no `pages` job, no `artifacts:` and no `environment:` -- the grep returns no match -- because publishing stays manual and stays on github.com via the two workflow_dispatch workflows. And neither GitHub workflow needed changing: f30a6185 touches nothing under .github/, deploy-public.yml and deploy-private.yml go through `npm run docs:ci` then `docs:build` / `docs:build-internal`, and those root script names are unchanged, the materialisation happening in `prebuild`.
  ```sh
  grep -nE '^\s*(pages|artifacts|environment):' .gitlab-ci.yml; git show --stat --format='' f30a6185 -- .github; grep -n '"docs:' package.json
  ```
- **43** (wrapup) Two claims written into commit messages were wrong and were corrected by amending f30a6185 twice before pushing. First, "the site had no CI at all": false -- the two GitHub workflows do build and publish it, they are simply workflow_dispatch only (the `push:` trigger is commented out in both), so what was missing was validation on a merge request, which is what the message now says. Second, the whole network was described as unreachable after a single `git ls-remote` failure against the internal GitLab host, and `nslookup`'s exit code was then misread: it is 0 even when the output reports a non-existent domain. The public internet was reachable throughout, so the executable Docusaurus build reported as blocked was never blocked -- and that build is what found four real defects (seq 34, 35, 38 and 40).
- **44** (build) The user, installing the site for the first time since C5, hit `npm ci` refusing the tree in docusaurus/. Commit 4205a812 (`build(docs): generate the Docusaurus tree from content/ before every build`) added docs-overlay-cli and docs-overlay-docusaurus to docusaurus/package.json and left docusaurus/package-lock.json untouched, so the lockfile no longer described the manifest. This is a defect in the migration itself, not in the tooling. Nobody caught it because the plan's rule was "never run `npm install` in docusaurus/, `npm ci` is safe", and neither command was run between C5 and the user's install -- every build in this journal ran against an already-installed node_modules. Found by a human, not by any verification recorded here. Fixed in mint commit 071e2411 (seq 51).
  ```sh
  npm ci  # in docusaurus/
  ```
- **45** (build) Measured the two ways of bringing docusaurus/package-lock.json back in sync, because they are not interchangeable. The user's plain `npm install` re-resolved the tree and drifted unrelated transitives -- algoliasearch 5.55.0 -> 5.56.0, plus browserslist, autoprefixer, baseline-browser-mapping, algoliasearch-helper, and address 1.2.2 -> 2.0.3 -- 87 packages changed, i.e. a nine-package addition riding inside an 87-package dependency refresh in a documentation commit. `npm install --package-lock-only` added exactly the 9 packages of the new closure and moved no existing resolution: 108 lines added, 1 removed, 0 versions changed. Validated with `npm ci --dry-run`: resolves, 28 packages added, no conflict. docs-overlay-cli went to ^0.1.1 rather than ^0.1.0 because 0.1.0 was published without its dist/ and fails at ERR_MODULE_NOT_FOUND on dist/cli.js -- unusable, not merely older.
  ```sh
  npm install --package-lock-only  # in docusaurus/, then npm ci --dry-run
  ```
- **50** (config) mint's lint-staged sends every staged *.json to oxfmt, and a lockfile is a *.json: oxfmt writes `"cpu": ["arm64"]` where npm writes the array across three lines. Neither committed lockfile is in oxfmt's shape -- `"cpu": [` alone on its line appears 46 times under docusaurus/ and 338 at the root -- so no lockfile had been staged since mint moved to oxfmt, and staging the regenerated one would have been the first time. Fixed preventively in mint commit 335dc1a7 (`chore(lint): never let the formatter own a generated lockfile`), one insertion adding `**/package-lock.json` to .oxfmtrc.json ignorePatterns: the same class as the existing docusaurus/content/** entry. Confirmed on disk at .oxfmtrc.json:23, sitting among the overlay's other generated-tree exclusions.
- **51** (build) mint commit 071e2411 (`build(docs): lock the overlay tooling the site now depends on`) fixed the seq 44 defect, and its diff is unreadable for a reason that has nothing to do with the change. Before the commit, `git ls-files --eol` reported `i/crlf w/lf attr/text=auto eol=lf` for docusaurus/package-lock.json, and `i/crlf w/crlf` for the root one: the file predates .gitattributes declaring `text=auto eol=lf`. npm rewrote it as LF, so `git add` normalised the whole file to the policy the repository already states -- the commit shows 21130 insertions and 21023 deletions for a 108-line semantic change, and docusaurus/package.json shows 122 changed lines for a one-line version bump. Both figures confirmed on disk from `git show --stat 071e2411`. `git ls-files --eol` now reports `i/lf w/lf` for docusaurus/package-lock.json and docusaurus/package.json, while the root package-lock.json is still `i/crlf w/crlf`: the normalisation happened, scoped to the two files this commit touched.
  ```sh
  git ls-files --eol docusaurus/package-lock.json docusaurus/package.json package-lock.json; git show --stat 071e2411
  ```
- **54** (wrapup) Corrected an assumption the plan stated. The plan said SECURITY-NOTES.md justifies the byte-identity of docusaurus/package-lock.json across branches by the identity of the package.json files. It does not: `grep -ic lock SECURITY-NOTES.md` returns 0, while `grep -c brace-expansion` returns 8 -- the file discusses only the accepted brace-expansion advisory. The byte-identity was my own measurement, not a documented assertion, so no section of SECURITY-NOTES.md needed updating in C5, and none was.
  ```sh
  grep -ic lock SECURITY-NOTES.md; grep -c brace-expansion SECURITY-NOTES.md
  ```
- **55** (build) Corrected the cause stated in entries 51 and 52. Both said `git add` renormalises a CRLF file to LF because .gitattributes declares `text=auto eol=lf`, and that this is why docusaurus/package-lock.json produced a 21130/21023-line diff for a 108-line change. Measured directly, it does not: staging an edited file that is already i/crlf in the index leaves it i/crlf and shows 0 insertions / 1 deletion. text=auto converts on the way in only for a path new to the index, so a tracked CRLF file keeps its CRLF through any number of edits. The real cause is simpler and belongs to npm: `npm install --package-lock-only` rewrote the whole file with LF terminators in the working tree, and git stored the bytes that were there. The same measurement is what made the 112-file frontmatter edit safe to stage in one go -- verified on a CRLF file among them, 0/1 with the index still i/crlf. The conclusion of entry 52 survives its wrong premise: storing LF matches the eol=lf every checkout already produces and is what stops the churn, whereas forcing CRLF back with hash-object --no-filters would hand the same 21000-line diff to whoever regenerates the file next.
  ```sh
  git add <a modified i/crlf file>; git diff --cached --numstat -- <it>; git ls-files --eol -- <it>
  ```

## `materialize`

- **27** (build) Established why the adapter copies pages byte for byte instead of re-emitting their frontmatter: Docusaurus' doc frontmatter Joi schema ends in .unknown() (docusaurus-plugin-content-docs/src/frontMatter.ts), so an overlay: key in a page's frontmatter passes validation untouched. Byte copying is also what preserves CRLF endings, encoding, @theme/Tabs imports and mermaid blocks. Divergence from the briefing worth recording: the schema claim was not re-verified at this instant, because neither /c/dev/docs-overlay nor /c/dev/mint-release-11.14.0 has any @docusaurus package installed; it rests on the earlier reading of the upstream source.
- **28** (build) Removed generated stubs from the doc-id and directory sets the sidebar merger treats as valid. The first version of the adapter added each generated stub's doc id to docIds, and two failures followed, both caught by tests: an inherited sidebar kept the entry for a page the version had tombstoned, and a renamed page's sidebar reference was never rewritten because the old doc id still looked present. materialize.ts now carries the exclusion and its reason at lines 184-187.
  ```sh
  npx vitest run packages/adapters/docusaurus
  ```
- **31** (build) Built packages/adapters/docusaurus (docs-overlay commit fe22811: 17 files added, 2 changed, 1490 insertions). materialize() returns a description of files to copy and files to write and performs no I/O itself. Also exported: docusaurusSlugify(), covering the three Docusaurus conventions where a file takes its folder's URL (index, README, and a file named after its own folder, case-insensitively), readDocusaurusDirectives(), withoutOverlayBlock(), pruneMissing(), strictSidebars(), referencesOf(), defaultTemplates, docUrl(), docIdOf() and declaredSlug(). Registered in the root build/typecheck/typecheck:packaged scripts and in the PACKAGES list of scripts/release.ts. Tests: 14 unit tests in src/materialize.test.ts plus architecture tests in test/architecture.test.ts, 18 in total, all filesystem-free except the architecture test, which reads its own package's sources. Divergence from the briefing: there are 4 architecture tests, not 3 -- the fourth is 'declares the core as its only dependency, and no peers'.
  ```sh
  npx vitest run packages/adapters/docusaurus --reporter=verbose
  ```
- **32** (verify) Ran the adapter against the real migrated tree through notes/migrations/mint-11.14.0/materialize-prototype.ts: 350 entries in, 600 files copied, 22 files written, 10 redirects, zero diagnostics. Versions came out as 11.13.0 -> /11.13.0, 11.14.0 at the root and next -> /next, which is the URL shape the site has today. The output holds 622 files: 168 under versioned_docs/version-11.13.0, 225 under versioned_docs/version-11.14.0, 225 under .docs-overlay/current, 2 versioned sidebars, 1 channel sidebar and versions.json.
  ```sh
  npx tsx notes/migrations/mint-11.14.0/materialize-prototype.ts /c/dev/mint-release-11.14.0/docusaurus <out-dir>
  ```
- **36** (config) Factored the two site configs onto docusaurus.config.base.js (222 lines added), cutting docusaurus.config.js and docusaurus.internal.config.js down to a `createConfig({...})` call each; they differ only by `url`, `baseUrl` and `deploymentBranch`. The whole `docs` block -- `path`, `sidebarPath`, `includeCurrentVersion`, `lastVersion`, `versions` -- is destructured from the materialiser's manifest at docusaurus.config.base.js:54 and spread into the plugin options at lines 103-106, so neither config file states them and the two cannot disagree. Reported as verified by loading both configs and comparing their `docs.versions`: identical. Divergence from the briefing and from the commit message, both of which say nine lines each: docusaurus.config.js is 9 lines, docusaurus.internal.config.js is 10, the extra line being its `deploymentBranch: 'gh-pages'`.
  ```sh
  wc -l docusaurus/docusaurus.config.js docusaurus/docusaurus.internal.config.js
  ```
- **37** (build) Added the anchored ignore rules and the prebuild wiring. docusaurus/.gitignore gained 11 lines: 4 comment lines, a blank line, and the rules `/docs/`, `/versioned_docs/`, `/versioned_sidebars/`, `/versions.json`, `/.docs-overlay/` -- plus `/build-internal`, a sixth rule the briefing did not name. docusaurus/package.json gained `materialize` (`docs-overlay materialize --label next="Next 🚧"`), `verify` (`docs-overlay materialize --check`), `check` (`docs-overlay check`), and `prebuild`, `prebuild-internal` and `prestart`, all three calling `npm run materialize`, plus the two new devDependencies docs-overlay-cli and docs-overlay-docusaurus at ^0.1.0. The leading slashes matter: an unanchored `docs/` also matches content/docs/ and would hide every source file under it, which is a failure that looks like a disappearance rather than an error. Checked both ways: `git check-ignore -v docusaurus/docs/x.md` reports docusaurus/.gitignore:26 `/docs/`, the same command on docusaurus/content/docs/mint/index.mdx reports nothing, and `git ls-files docusaurus/content` counts 352 files today (351 at this commit, before content/README.md was added at f30a6185 -- the 351 the commit message states).
  ```sh
  git check-ignore -v docusaurus/docs/x.md docusaurus/content/docs/mint/index.mdx; git ls-files docusaurus/content | wc -l
  ```
- **38** (build) `--base-url /sba-mint/` passed on a Git Bash command line arrived as `C:/Program Files/Git/sba-mint/`, because MSYS rewrites arguments shaped like absolute POSIX paths. The value only ends up inside generated links, so nothing crashed: it poisoned the URL in ten generated pages. The guard now lives in the docs-overlay CLI at packages/cli/src/cli.ts:96, applied to the URL-valued flag that survived seq 39's removal of `--base-url`, namely `--route-base-path`, and is documented in packages/cli/README.md.
- **40** (build) `export const target = useBaseUrl("...")` in the MDX stub template broke static generation for all 10 redirect stubs: an `export` in MDX is a module-level binding, so the hook ran outside the component and React rejected it. The build reported `static site generation failed for 10 paths` and named them. The template now calls the hook inline in each JSX expression, three times per page, with the reason recorded in a comment above it.
- **46** (sidebars) The user started the dev server and found the nine generated stubs listed among the real documents -- "Moved to ..." entries, and "Search (removed in 11.14.0)". The adapter emits one page per routable slug that is not a page (a <Redirect> per renamed page, an explanatory page per tombstone; 9 of them on mint 11.14.0), each carrying `unlisted: true` to stay out of navigation. Docusaurus computes that in node_modules/@docusaurus/utils/lib/contentVisibilityUtils.js as `isUnlisted({frontMatter, env}) => (isProduction(env) && frontMatter.unlisted) ?? false`, so the flag is inert in development: `docusaurus build` hid every stub -- which is exactly why seq 41's verification passed, 620 pages with onBrokenLinks 'throw' -- while `npm start` showed all nine. The lesson is worth recording on its own: a verification run only in production mode cannot see this class of defect, and production is the mode that matters least to the person writing the docs. Found by a human running the dev server, not by any verification in this journal. One detail from disk that the briefing did not carry: the same module also honours SIMULATE_PRODUCTION_VISIBILITY=true, a third way to reproduce production visibility without a build.
  ```sh
  npm start  # in docusaurus/
  ```
- **47** (sidebars) The unlisted filter removed 7 of the 9 stubs. The 2 survivors -- mint/configurations/customization and mint/features/search, the only two of the nine whose slug also names a directory -- are what pointed at the adapter rather than at the site configuration. stubPath() used to write <slug>/index.mdx whenever the slug also named a directory, on the belief that a file and a directory cannot share a name. They can: customization.mdx sits beside customization/, they differ by the extension. The special case was actively harmful, because Docusaurus reads index.mdx as the category index of its folder: the stub became the category's `link` and supplied its label, so the sidebar read "Moved to mint/configurations/customization/custom-json-files" where "Customization" belonged, and "Search (removed in 11.14.0)" where "Search" belonged. Worse, it made the obvious remedy blind -- a category index is no longer a doc item, so the withoutUnlisted() doc-item filter of seq 46 could never reach the two that mattered. Fixed in docs-overlay commit 223ade2 (PR #15, changeset proud-doors-sidebar): stubPath() always returns <slug>.mdx, and beside the directory a stub is an ordinary page -- same slug, same route, no category captured. 327 tests pass; the adapter's unit test was rewritten to "puts a stub beside a directory of the same name, never inside it as an index".
- **48** (sidebars) mint commit 6cbb37a7 (`fix(docs): keep generated stubs out of the sidebar in development`) landed the seq 46 workaround: 41 insertions, 3 deletions, one file. `withoutUnlisted(items, docs)` at docusaurus/docusaurus.config.base.js:69 builds a Set of the doc ids whose frontMatter.unlisted is true, filters `doc` and `ref` items out of the generated items, recurses into categories, and drops a category the filter empties rather than emitting it empty. It is wired at docusaurus.config.base.js:148-150 inside sidebarItemsGenerator, composed with the pre-existing capitalizeCategories(). The comment above it states the rule in its general form: this is not overlay-specific, any page marked unlisted stops appearing in a generated sidebar, which is what the flag reads as meaning.
  ```sh
  git show --stat 6cbb37a7
  ```

## `materialize --check`

- **33** (verify) Compared the materialised output against the pre-migration reference snapshot, extracted with git archive 403b6b15 (575 files: docs 216, versioned_docs/version-11.13.0 168, versioned_docs/version-11.14.0 188, versioned_sidebars 2, versions.json 1). 11.13.0 materialised is byte-identical to the original versioned_docs/version-11.13.0 across all 168 files, and versions.json and versioned_sidebars/version-11.13.0-sidebars.json are byte-identical to the originals. 11.14.0 materialised differs from the original docs/ in exactly two intended ways: 9 added files (5 rename stubs and 4 tombstone stubs, so 216 + 9 = 225) and 5 files whose only change is the +2 lines of the overlay: block the migration itself added to the source, with nothing removed. The channel's 225-file tree is identical to 11.14.0's except for the 5 redirect stubs, whose URLs correctly carry /next/ where the root-served version does not. All three generated sidebars are valid for their own version: every doc id resolves to a file that exists (6, 7 and 7 doc ids) and every autogenerated directory exists (20, 24 and 24 blocks). Observation worth keeping: the tombstone for mint/features/search/search landed at mint/features/search/index.mdx, because a file named after its own folder takes the folder's URL -- the third slug convention, firing on real content.
  ```sh
  md5sum of every file in each materialised version, diffed against the same listing over the git archive 403b6b15 snapshot, plus a walk of each generated sidebar resolving every doc id and every autogenerated dirName against that version's own docs directory
  ```
- **41** (verify) Both Docusaurus builds pass with `onBrokenLinks: 'throw'`, 620 HTML pages each, from a single materialisation: public with baseUrl /sba-mint/ and internal with /pages/Product/sba-mint/, each rendering its own into the generated stubs. 11.13.0 serves 167 doc routes. The root and /next/ serve identical doc route sets, 224 pages each; the root's 5 extra entries -- 11.13.0, 404, index, markdown-page, next -- are the site's own pages and version landings, not content. All 9 stub routes answer 200, and `unlisted: true` keeps the old slug out of the rendered sidebar while keeping its route: both halves confirmed. The only warnings are two pre-existing broken anchors. Re-counted from the two build directories still on disk: build and build-internal hold 620 .html files each; build/11.13.0 holds 167; build/next holds 224 and the root's atomic (75) + atomic-angular (104) + mint (44) + changelog.html sum to the same 224; 10 redirect stubs (5 per tree) and 8 tombstone stubs (4 per tree) are present, which is the 9 stubs per tree that the 9 stub routes refer to; the same stub renders href="/sba-mint/mint/configurations/customization/custom-json-files" under build and href="/pages/Product/sba-mint/..." under build-internal; and href="/sba-mint/mint/configurations/customization" appears in exactly 2 files, the two stub pages themselves, so no sidebar lists the old slug.
  ```sh
  npm run build && npm run build-internal  # in docusaurus/, each preceded by prebuild -> npm run materialize; then: find build -name '*.html' | wc -l; find build-internal -name '*.html' | wc -l; find build/11.13.0 -name '*.html' | wc -l; find build/next -name '*.html' | wc -l; grep -rl 'This page moved to' --include='*.html' build; grep -rl 'This page was removed in' --include='*.html' build
  ```
- **49** (verify) My verification of the stubPath fix was worthless and the user caught it. The site consumes docs-overlay-docusaurus from npm -- ^0.1.0 in docusaurus/package.json at that point -- not from the monorepo, so a fix in the monorepo does not reach the site until it is published. I materialised with my local build and then ran `npx docusaurus start`, which skips the prestart script. The user ran `npm start`, whose prestart is `npm run materialize`, i.e. the published adapter, which rewrote customization/index.mdx as a stub and brought the bad category label straight back. The user reported "les folders expand/collapsed contiennent toujours la mention 'moved to xxx'" and was right: I had been measuring a tree that the real pipeline overwrote on its next run.
  ```sh
  npm start  # in docusaurus/ -- runs prestart -> npm run materialize; NOT npx docusaurus start, which skips it
  ```
- **53** (verify) Re-verified the episode through the project's own script -- so through prestart -> `npm run materialize` -- with the fixed adapter in place, which is the mistake of seq 49 not repeated. Reported: `files 622 planned - 4 written - 618 unchanged` and `removed 4 file(s)`; 0 index.mdx under versioned_docs and under .docs-overlay/current; no "Moved to" and no "(removed in" label in any sidebar of any of the 3 versions; the categories back to Customization and Search in all 3 versions; no previous/next navigation pointing at a stub; all 9 stub routes answering 200; and the production build unchanged at 620 pages with onBrokenLinks 'throw'. State on disk worth recording, since it moved after this run: docs-overlay 0.1.1 was released at 14:02:24Z (PR #16), docusaurus/node_modules/docs-overlay-docusaurus now reports version 0.1.1 with a dist mtime of 14:05:10Z, and mint's worktree carries an uncommitted bump of docs-overlay-docusaurus from ^0.1.0 to ^0.1.1 (1 line in the manifest, 4 in the lockfile) -- the disposable dist copy of seq 49 has been superseded by the published release, and that bump is not committed yet.
  ```sh
  npm start  # in docusaurus/, then npm run build
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

