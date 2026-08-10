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

