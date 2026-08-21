# docs-overlay-mermaid

## 0.3.1

### Patch Changes

- ebe912c: Accept a hyphen inside a flowchart node id, and keep a quoted inline label whole.

  `user-service --> api-gateway` is idiomatic Mermaid and used to be a syntax error: the id stopped at the hyphen and the rest of the word was read as a broken link. A hyphen now continues an id when a word character follows it, which leaves a link written without spaces alone — `A-->B`, `a-b-->c-d` and `x-.->y` all still parse as links.

  `A -- "a--b" --> B` also works now. Unquoted, the `--` inside the label closed the link early and the remainder became a phantom node: `A -- a--b --> B` came out as three nodes. The scanner steps over a quoted span instead, which makes quoting a real escape hatch rather than advice that did not work. Unquoted is still read as a link, and the readme says so.

- f1b6a53: Document that `architecture-beta` edge labels are unavailable, and why.

  The AST `@mermaid-js/parser` publishes carries a `title` on an edge, and the grammar it ships has no token for one — every candidate syntax is a parse error. Mermaid has added `'-' title '-'` to the arrow rule upstream since, so labels will start working on a parser bump rather than on a change here. The readme no longer calls `architecture-beta` support "full", and the code path that would place such a label says it is currently unreachable.

  Also records, next to the claim it bounds, that `stylesheet: "external"` saves about half what the byte arithmetic suggests on a React Server Components build: the framework emits every element twice, as HTML and in the RSC payload.

## 0.3.0

### Minor Changes

- dc3d6b3: Add the `minimal` theme, and let a theme decide whether icons are drawn at all.

  `minimal` is decoration removed rather than restyled: no icon, no accent bar, no shadow, no plate, a hairline border and one ink colour. It is also the smallest of the three in bytes — with nothing reading `--do-accent`, the renderer omits the fifteen per-type declarations as well.

  `NodeTheme` gains `icons` and `accentStripe`, both defaulting to on. `icons` has to be a theme decision rather than an absence in `semanticTypes`: the semantic stage writes an icon name onto a node before the renderer sees it — a default rule matching "PostgreSQL" carries `database` whatever the theme says — so without the flag a theme had no way to decline. The semantic model proposes; the theme disposes.

- dc3d6b3: Add `diagramStylesheet(theme)` and `RenderOptions.stylesheet`, so a page with several diagrams carries the CSS once.

  Inlined, the theme's rules are the largest part of a small diagram — 4.3 kB against about 2 kB of drawing — and every diagram repeated them. `stylesheet: "external"` leaves the `<style>` element out and the caller emits `diagramStylesheet(theme)` once; `scopeOf(theme)` names the class every rule is scoped to. `"inline"` remains the default, because an SVG opened on its own has nowhere else to carry its styles.

  Measured on the documentation site, whose Diagrams page renders four: 227.9 kB to 202.1 kB. On a two-node diagram the SVG drops by 70%.

## 0.2.1

### Patch Changes

- 77d1432: Export `ShadowTheme` and `IconPlateTheme`, which 0.2.0 documented but did not ship.

  Both were described in the readme and the changelog, and neither was re-exported from the entry point, so `import type { ShadowTheme } from "docs-overlay-mermaid"` failed to compile. A `patch` rather than a `minor`: the surface the documentation describes is unchanged, only the implementation now matches it.

  `packages/adapters/mermaid/test/public-surface.ts` now restates the published surface so a compiler checks it. Nothing could have caught this before — `tsc` only sees a package's own sources, and a missing _type_ export is invisible at runtime, so no test could observe it.

## 0.2.0

### Minor Changes

- 7c99475: Add the `illustrated` theme, and the two theme mechanisms it needs.

  `renderMermaid(source, { theme: "illustrated" })` draws the same diagram as cards: the icon sits on a tinted plate, node shapes carry a soft shadow and a wider corner radius, and spacing and type are more generous. `technical` is unchanged, byte for byte.

  `NodeTheme` gains two optional fields, so a custom `DiagramTheme` can use them too: `shadow` (`{ dy, blur, opacity }`, emitted as an SVG filter) and `iconPlate` (`{ radius, opacity, padding }`, which the layout accounts for when sizing a node). A theme that sets neither emits no filter and no plate rule at all. `illustratedTheme`, `ShadowTheme` and `IconPlateTheme` are exported.

## 0.1.0

### Minor Changes

- 4700cba: Add `docs-overlay-mermaid`: Mermaid sources to a modern technical SVG, at build time and without a browser.

  `renderMermaid(source, options)` parses `flowchart` (a documented subset) and `architecture-beta`, infers what each node _is_ — `database`, `api`, `cache`, `person` — and renders an accessible, theme-aware SVG. The stages are exported separately (`parseMermaid`, `enrichMermaid`, `layoutDiagram`, `renderSvg`, `detectDiagramType`) so an integrator can reuse the semantic model to drive a renderer of their own.

  Notable properties: no DOM, no filesystem and no network at render time; byte-identical output for the same input; every colour read through a `--docs-overlay-diagram-*` custom property with a dark fallback; `role="img"` with a generated `<title>` and `<desc>`; `semantic.rules` to override the built-in heuristics; `tolerant` to render a diagram a Markdown stream has only partly delivered; and `fallback` to hand an unsupported diagram type elsewhere without making `mermaid` a dependency.
