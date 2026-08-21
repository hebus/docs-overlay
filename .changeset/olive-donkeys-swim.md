---
"docs-overlay-mermaid": minor
---

Add the `minimal` theme, and let a theme decide whether icons are drawn at all.

`minimal` is decoration removed rather than restyled: no icon, no accent bar, no shadow, no plate, a hairline border and one ink colour. It is also the smallest of the three in bytes — with nothing reading `--do-accent`, the renderer omits the fifteen per-type declarations as well.

`NodeTheme` gains `icons` and `accentStripe`, both defaulting to on. `icons` has to be a theme decision rather than an absence in `semanticTypes`: the semantic stage writes an icon name onto a node before the renderer sees it — a default rule matching "PostgreSQL" carries `database` whatever the theme says — so without the flag a theme had no way to decline. The semantic model proposes; the theme disposes.
