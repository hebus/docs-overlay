---
"docs-overlay-cli": minor
---

`check`, `cut` and `prune` no longer need the Docusaurus adapter installed, and `--dialect` chooses the conventions a tree is read with.

`src/site.ts` imported `docs-overlay-docusaurus` at module level — for the slug rules, the directive reader
and the `sidebars.json` shape — and a single bundle made that every command's problem, not just
`materialize`'s. Declared as a devDependency, the monorepo hoisted it and every test passed, while an
install from the registry left all four commands throwing `ERR_MODULE_NOT_FOUND` before doing any work.

Those four decisions are now a `SiteDialect`, passed in rather than imported. `genericDialect` derives
slugs with the engine's own rules and reads no navigation file; `resolveDialect()` returns the Docusaurus
one when the site has a `docusaurus.config.*` — `.cjs` included, which the old detection missed — and the
generic one otherwise, along with the reason, which `check` and `prune` now print. `--dialect
docusaurus|generic` overrides the detection. The adapter moves to an optional peer dependency, which is
what it is: needed to `materialize`, and to read a Docusaurus tree correctly, but not to run.

The two dialects derive **different slugs**, so choosing wrongly would point every directive at a URL that
does not exist — with nothing to report, since both sides would look internally consistent. Two things make
that hard to do by accident: a missing adapter on a Docusaurus site is an error rather than a silent
fallback to the generic rules, and a `sidebars.json` found while reading generically fails the command
instead of being carried along as an ordinary file. `prune` checks before it removes anything.

Breaking, for a caller using this package as a library rather than as a binary: `readSite()` now requires
`dialect`, so code relying on it having always been Docusaurus fails to compile rather than quietly
changing which slugs it computes. `checkCommand()`, `pruneCommand()` and `materializeCommand()` take an
optional `dialect`; omitting it reads the tree generically, except in `materializeCommand()`, which
resolves the Docusaurus dialect itself. `ReadSiteOptions.sidebarsFile` is gone — `SiteDialect.navigation`
carries the navigation file name now.
