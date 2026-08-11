# docs-overlay-fumadocs

## 0.2.3

### Patch Changes

- 7dbf142: Documentation served from the site root no longer gets a doubled separator in every URL.

  `baseUrl: "/"` — the shape a site publishes when its documentation _is_ the site, which Docusaurus writes
  as `routeBasePath: '/'` — reached three template literals that appended their own separator to a base that
  already ended in one. The result was `//mint/features/preview`, which a browser reads as protocol-relative
  and resolves against a host named `mint`: every page link, every version landing page, every canonical and
  every redirect target left the site.

  The three sites now share an internal `joinUrl()` helper, so the root case is handled once rather than at
  each call. Nested base URLs are unchanged, with or without a trailing slash.

## 0.2.2

### Patch Changes

- 4a6eed7: Say what each package is for on its npm page. The descriptions led with the implementation rather
  than the problem — the Docusaurus one read as a remark about Docusaurus — and the keywords omitted the
  terms someone looking for this would search: documentation versioning, versioned documentation,
  Fumadocs and Docusaurus versioning, monorepo. The rewritten readmes ship with them. No code change.
- Updated dependencies [4a6eed7]
  - docs-overlay@0.2.1

## 0.2.1

### Patch Changes

- Updated dependencies [523a4bb]
  - docs-overlay@0.2.0

## 0.2.0

### Minor Changes

- 37865f6: Serve several documentations from one site, each versioned on its own. `overlaySource({ scope })` names
  the product an instance serves: its version folders live under `content/docs/<scope>/`, its URLs start
  at `/docs/<scope>/`, and it has its own `latest` — so a monorepo publishing packages on separate
  schedules no longer needs one version list for all of them. Several scoped instances feed a single
  `loader()`, which keeps one page tree, one search index and working relative links; the scope reaches
  paths, slugs and params, so two products holding the same slug no longer overwrite each other.
  `resolveRoute()` refuses a scope that is not its own instead of looking for it as a page of the root
  version, and the new `searchTagsOf()` tags an index entry with both product and version — `versionTagOf()`
  would report the product once a scope exists. Leaving `scope` out changes nothing.
- 7692ab4: Report where an inherited page comes from, so a reader is not left thinking they are reading a version
  that never touched it. `resolveRoute()` now returns `inheritedFrom: { version, hops }` on a `page`
  resolution whose file the browsing version does not own — absent when it does, so an owned page keeps
  the shape it had. Aliases carry it too. The new `inheritedNotice` option of `overlaySource()` (default
  `true`) records whether a project wants that shown; it is carried for the rendering layer to honour and
  never changes what `resolveRoute()` reports.

## 0.1.0

### Minor Changes

- cd1f57e: First release.

  `docs-overlay` resolves versioned documentation where each version folder holds only its
  differences. `createOverlay()` folds the inheritance chain into one materialised index per version, so
  `resolve(version, slug)` is a single lookup returning `own`, `inherited`, `alias`, `redirect`,
  `deleted`, `missing` or `unknown-version`. Deletions are tombstones living in the version that removes
  them, renames declare `renamedFrom` on the new file, and redirects are inherited forward so an external
  link never decays into a 404. Includes `getDependents()` and `invalidate()` for incremental rebuilds,
  plus `getEntries()` so an adapter can enumerate every routable slug. Zero runtime dependencies, no Node
  built-ins, no framework.

  `docs-overlay-fumadocs` re-projects the source `fumadocs-mdx` already built through that engine.
  `overlaySource()` feeds a single `loader()` covering every version, `resolveRoute()` turns route params
  into a decision, `staticParams()` enumerates every routable slug in the shape the URLs take, and
  `switchVersion()` handles the case where the target version never had the current page. `latestAtRoot` serves one version at the base URL — the newest release, or simply the newest version before the first release, exposed as `root` and `isRoot`. Navigation is
  inherited per directory, with an exhaustive `pages` list completed so newly added pages stay visible.
  `withOverlay()` from the `./schema` subpath is required: `pageSchema` strips unknown keys, so overlay
  directives are otherwise discarded in silence.

### Patch Changes

- Updated dependencies [cd1f57e]
  - docs-overlay@0.1.0
