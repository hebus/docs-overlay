# docs-overlay

## 0.2.0

### Minor Changes

- 523a4bb: Add `planSnapshots()`, which turns N full version snapshots into an overlay.

  A framework that versions documentation by copying the whole tree leaves one complete folder per
  release behind. `planSnapshots()` plans the conversion: which files a version has nothing to say about
  and can be dropped, which slugs moved, which disappeared, and — the part that matters — which of those
  a machine has no business deciding alone. It answers the same question the resolver answers at read
  time, asked in reverse, which is why it belongs to the engine rather than to a migration tool.

  Two rules in the rename heuristic were forced by a real corpus rather than designed, and both exist to
  stop the tool from confidently lying:

  - **A candidate the parent version already served can never be a rename target.** The two pages
    coexisted, so a permanent redirect between them would claim a move that never happened. Such
    candidates stay available as `replacedBy` suggestions, which turns a wrong answer into an answerable
    question.
  - **A line-identical body beats any filename.** A page that moved into a new directory _and_ was
    renamed scores perfectly on content and zero on its stem, and the weighted score alone sends the
    strongest evidence available to a human for no reason. A uniqueness guard keeps a genuinely
    duplicated page from being read as a move.

  The diff is keyed on **slugs**, not filenames, so a page whose extension changed comes out as one
  override rather than a deletion plus an addition — a distinction a filename diff gets wrong silently,
  because the counts still add up.

  New exports: `planSnapshots`, `decisionKey`, `rankCandidates`, `replacementSuggestions`, `comparable`,
  `contentScore`, `stemScore`, `pathScore`, `titleScore`, `DEFAULT_WEIGHTS`, `DEFAULT_THRESHOLDS`, and
  their types. Still zero dependencies, no Node built-ins, synchronous, and it never throws on bad
  content — problems come back as `Diagnostic`s like everywhere else.

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
