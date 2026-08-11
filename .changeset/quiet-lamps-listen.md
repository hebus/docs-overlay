---
"docs-overlay-cli": patch
---

Report each diagnostic once. `check` and `materialize` each read the same problems from two overlapping
sources — the sink the engine pushes through while the tree is read, and the list `overlay.diagnostics()`
or a materialisation plan returns afterwards — and printed the overlap twice, so a site with two warnings
appeared to have four. `materialize --json` now carries the same set as its text output, which previously
held only the plan's own diagnostics.
