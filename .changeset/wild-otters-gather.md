---
"@docs-overlay/core": minor
"@docs-overlay/fumadocs": minor
---

First release.

`@docs-overlay/core` resolves versioned documentation where each version folder holds only its
differences. `createOverlay()` folds the inheritance chain into one materialised index per version, so
`resolve(version, slug)` is a single lookup returning `own`, `inherited`, `alias`, `redirect`,
`deleted`, `missing` or `unknown-version`. Deletions are tombstones living in the version that removes
them, renames declare `renamedFrom` on the new file, and redirects are inherited forward so an external
link never decays into a 404. Includes `getDependents()` and `invalidate()` for incremental rebuilds,
plus `getEntries()` so an adapter can enumerate every routable slug. Zero runtime dependencies, no Node
built-ins, no framework.

`@docs-overlay/fumadocs` re-projects the source `fumadocs-mdx` already built through that engine.
`overlaySource()` feeds a single `loader()` covering every version, `resolveRoute()` turns route params
into a decision, `staticParams()` enumerates every routable slug in the shape the URLs take, and
`switchVersion()` handles the case where the target version never had the current page. `latestAtRoot` serves one version at the base URL — the newest release, or simply the newest version before the first release, exposed as `root` and `isRoot`. Navigation is
inherited per directory, with an exhaustive `pages` list completed so newly added pages stay visible.
`withOverlay()` from the `./schema` subpath is required: `pageSchema` strips unknown keys, so overlay
directives are otherwise discarded in silence.
