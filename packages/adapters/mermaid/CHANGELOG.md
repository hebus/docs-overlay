# docs-overlay-mermaid

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
