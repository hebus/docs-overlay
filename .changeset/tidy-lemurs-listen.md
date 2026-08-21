---
"docs-overlay-mermaid": patch
---

Export `ShadowTheme` and `IconPlateTheme`, which 0.2.0 documented but did not ship.

Both were described in the readme and the changelog, and neither was re-exported from the entry point, so `import type { ShadowTheme } from "docs-overlay-mermaid"` failed to compile. A `patch` rather than a `minor`: the surface the documentation describes is unchanged, only the implementation now matches it.

`packages/adapters/mermaid/test/public-surface.ts` now restates the published surface so a compiler checks it. Nothing could have caught this before — `tsc` only sees a package's own sources, and a missing _type_ export is invisible at runtime, so no test could observe it.
