# Decisions only a human can make

Derived from every `scriptable: false` entry. Each one is a prompt the migration command must ask,
and `Not taken` is its option list. Note how often the answer was *nothing*: a prompt that pushes
towards naming a target would have produced three wrong redirects here.

## 20. Tombstone atomic/changelog with no replacedBy.

The two candidates were already disqualified as rename targets because 11.13.0 serves them too, and neither is a real successor. The root changelog (600 lines in 11.13.0) documents all notable changes to the SBA Mint project, a different product scope. The atomic/changelogs/ directory that 11.14.0 introduces has five files and no index page, so any pick among them is arbitrary. A pointer to a merely adjacent page is worse than telling the reader the page is gone and which version still has it.

**Options not taken** `replacedBy: changelog -- which is what the 11.14.0 sidebar did, replacing the atomic/changelog entry with changelog` · `replacedBy: atomic/changelogs/CHANGELOG_v0.0.124_to_v0.0.129`

## 21. Tombstone mint/features/search/search with no replacedBy.

The only page left in that section is data-flow, whose own description calls it a deep dive into how search parameters, URL state, stores, TanStack Query and the rendered results are kept in sync. It addresses a different audience: pointing a newcomer at a deep dive is worse than telling them the introduction was removed and which version still carries it.

**Options not taken** `replacedBy: mint/features/search/data-flow`

## 22. Tombstone mint/features/search/search-all with no replacedBy.

mint/search-all-layout covers the same component and survives by inheritance, but it already existed in 11.13.0 byte-identically (blob 7ea576d7 in both trees), so the two pages coexisted and it never replaced anything. Recording it as the replacement would invent a move that did not happen.

**Options not taken** `replacedBy: mint/search-all-layout`

## 39. Remove `baseUrl` from the adapter entirely and let generated pages resolve it with `useBaseUrl` at build time, rather than baking an absolute URL in at generation time.

This site has two deployment targets with different baseUrl values. A baked-in URL means one materialisation per target -- 18 files rewritten on every switch -- and `materialize --check` in CI would then depend on which target ran last, so the same source tree would pass or fail depending on build order.

**Options not taken** `Keep `--base-url` and materialise once per deployment target` · `Generate relative links instead of site-root-relative paths`

## 52. Normalise the lockfile to LF in the index rather than preserving its CRLF with `hash-object --no-filters` + `update-index`.

`eol=lf` means every checkout is LF and npm writes LF, so normalising stops the churn once and for all, whereas preserving CRLF defers an identical 21000-line diff to whoever next regenerates the file -- and they will not have chosen it. The cost is one unreviewable diff, paid down by isolating the lockfile in its own commit and giving the `tr -d '\r'` recipe to read it.

**Options not taken** `Preserve the index's CRLF with `git hash-object --no-filters` + `git update-index`, keeping a 108-line reviewable diff and leaving the renormalisation for whoever regenerates the file next` · `Renormalise every CRLF-in-index file in the repository in one dedicated commit, root package-lock.json included, so the policy and the index agree everywhere at once`

