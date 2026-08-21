# docs-overlay-mermaid

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
