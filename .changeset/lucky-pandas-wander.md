---
"docs-overlay-mermaid": minor
---

Add the `illustrated` theme, and the two theme mechanisms it needs.

`renderMermaid(source, { theme: "illustrated" })` draws the same diagram as cards: the icon sits on a tinted plate, node shapes carry a soft shadow and a wider corner radius, and spacing and type are more generous. `technical` is unchanged, byte for byte.

`NodeTheme` gains two optional fields, so a custom `DiagramTheme` can use them too: `shadow` (`{ dy, blur, opacity }`, emitted as an SVG filter) and `iconPlate` (`{ radius, opacity, padding }`, which the layout accounts for when sizing a node). A theme that sets neither emits no filter and no plate rule at all. `illustratedTheme`, `ShadowTheme` and `IconPlateTheme` are exported.
