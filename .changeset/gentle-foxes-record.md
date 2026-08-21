---
"docs-overlay-mermaid": patch
---

Document that `architecture-beta` edge labels are unavailable, and why.

The AST `@mermaid-js/parser` publishes carries a `title` on an edge, and the grammar it ships has no token for one — every candidate syntax is a parse error. Mermaid has added `'-' title '-'` to the arrow rule upstream since, so labels will start working on a parser bump rather than on a change here. The readme no longer calls `architecture-beta` support "full", and the code path that would place such a label says it is currently unreachable.

Also records, next to the claim it bounds, that `stylesheet: "external"` saves about half what the byte arithmetic suggests on a React Server Components build: the framework emits every element twice, as HTML and in the RSC payload.
