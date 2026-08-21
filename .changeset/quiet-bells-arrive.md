---
"docs-overlay-mermaid": minor
---

Add `diagramStylesheet(theme)` and `RenderOptions.stylesheet`, so a page with several diagrams carries the CSS once.

Inlined, the theme's rules are the largest part of a small diagram — 4.3 kB against about 2 kB of drawing — and every diagram repeated them. `stylesheet: "external"` leaves the `<style>` element out and the caller emits `diagramStylesheet(theme)` once; `scopeOf(theme)` names the class every rule is scoped to. `"inline"` remains the default, because an SVG opened on its own has nowhere else to carry its styles.

Measured on the documentation site, whose Diagrams page renders four: 227.9 kB to 202.1 kB. On a two-node diagram the SVG drops by 70%.
