---
"docs-overlay": minor
---

Add `planSnapshots()`, which turns N full version snapshots into an overlay.

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
