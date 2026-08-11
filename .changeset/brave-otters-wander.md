---
"docs-overlay": patch
---

No behaviour change: the NUL byte that separates the parts of a composite cache key is now written as
an escape sequence rather than embedded as a literal control character. Git decides a file is binary
from a NUL in its first 8000 bytes, which made `graph/dependency-graph.ts` binary and its diffs
unreviewable. The keys themselves, `decisionKey()` included, are byte for byte what they were.
