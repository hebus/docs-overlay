# docs-overlay-mermaid

[![npm](https://img.shields.io/npm/v/docs-overlay-mermaid)](https://www.npmjs.com/package/docs-overlay-mermaid)
[![types](https://img.shields.io/npm/types/docs-overlay-mermaid)](https://www.npmjs.com/package/docs-overlay-mermaid)
[![license](https://img.shields.io/npm/l/docs-overlay-mermaid)](./LICENSE)

Mermaid in, a modern technical SVG out — at build time, with no browser.

```ts
import { renderMermaid } from "docs-overlay-mermaid";

const { svg } = await renderMermaid(`
  flowchart LR
    Developer --> Angular
    Angular --> API
    API --> PostgreSQL
    API --> Redis
`);
```

`PostgreSQL` comes out drawn as a database, `Redis` as a cache, `Developer` as a person. Nobody
annotated anything: the package reads the labels.

## Why this exists

Rendering Mermaid is a solved problem — twice over. You can ship the Mermaid bundle to the reader's
browser, or render at build time with `rehype-mermaid`, which drives a headless Chromium through
Playwright. Both work.

What neither does is produce an SVG at build time **without a browser**. This does. The output is
static HTML: no JavaScript reaches the reader, no network request happens during the build, and the
same input always produces the same bytes.

The second thing it does is the reason it is not just a converter. Between the parser and the
renderer sits a **semantic model** — a node is a `database`, an `api`, a `person` — and that is what
a theme draws. Adding a renderer that is not SVG means implementing one interface, not touching the
parser.

## Install

```bash
npm install docs-overlay-mermaid
```

You do not need `mermaid` itself. `@mermaid-js/parser`, Mermaid's own grammar package, is pulled in
for `architecture-beta` and loaded lazily, so a bundle that only renders flowcharts never pays for
it.

## What it renders

| Diagram                                                        | Support                               |
| -------------------------------------------------------------- | ------------------------------------- |
| `flowchart` / `graph`                                          | a documented subset, below            |
| `architecture-beta`                                            | through Mermaid's own Langium grammar |
| `sequenceDiagram`, `classDiagram`, `stateDiagram`, `erDiagram` | not yet — see [Fallback](#fallback)   |

Anything else raises a `MermaidError` whose `code` says which of the two cases it is: a diagram type
that is recognised but unsupported, or text that is not a diagram at all.

One gap in `architecture-beta` is not this package's doing: **edge labels**. The AST that
`@mermaid-js/parser` publishes carries a title on an edge, and the grammar it ships has no token for one,
so there is no syntax to write — every candidate is a parse error. Mermaid has added it upstream since,
so it will start working on a parser bump rather than on a change here.

### The flowchart subset

Mermaid has no standalone flowchart parser — `@mermaid-js/parser` does not cover flowcharts, and the
JISON grammar inside `mermaid` needs a DOM. So this package brings its own, over a stated subset:

- **Header** `flowchart` or `graph`, direction `TB` / `TD` / `BT` / `RL` / `LR`
- **Shapes** `[rect]` `(round)` `([stadium])` `[[subroutine]]` `[(cylinder)]` `((circle))`
  `{rhombus}` `{{hexagon}}`
- **Links** `-->` `---` `-.->` `-.-` `==>` `===` `--o` `--x` `<-->` `o--o` `x--x`
- **Link labels** `-->|text|` and `-- text -->`
- **Chains** `A --> B --> C`, and fan-out `A & B --> C & D`
- **Subgraphs** `subgraph id [Title] … end`, nested
- **Classes** `classDef`, `class a,b name`, `A:::name` — carried through as opaque names
- **Ignored, on purpose** `style`, `linkStyle`, `click`, `direction`, `%%{init}%%`: all of them need a
  browser to mean anything
- **Frontmatter**, `%%` comments, and `;` as a line separator

Outside that, it raises rather than guesses. Node ids are `[A-Za-z0-9_.]` plus anything above ASCII, and
may contain a hyphen where a word character follows it — `user-service` is an id, while `A-->B` is still a
link. A label containing `--` has to be quoted, `A -- "a--b" --> B`, or use the pipe form,
`A -->|a--b| B`; unquoted it is read as a link and the rest of the label becomes a node.

## Themes

Three themes ship.

| Theme         | Look                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `minimal`     | decoration removed: no icon, no accent bar, no shadow, a hairline border, one ink colour       |
| `technical`   | flat, with an accent stripe carrying the semantic type — the default                           |
| `illustrated` | the same diagram as cards: the icon on a tinted plate, a soft shadow, a wider radius, more air |

```ts
await renderMermaid(source, { theme: "illustrated" });
```

Neither adds gradients, hand-drawn outlines or a second colour per node: each would date the output,
and a diagram in documentation outlives the styling fashion it was drawn in.

Asking for a theme that does not exist raises rather than falling back — a silent substitution would
ship the wrong look and say nothing. A theme is plain data, so a `DiagramTheme` of your own can be
passed where a name goes; `NodeTheme` carries the switches the shipped themes use (`icons`,
`accentStripe`, `shadow`, `iconPlate`), and a theme that sets none of them emits no filter, no plate and
no rule for either.

### One stylesheet per page

The theme's rules are the largest part of a small diagram — around 4.3 kB against 2 kB of drawing — and
inlining them repeats them in every diagram on the page. A caller that can put CSS on the page once:

```ts
import { diagramStylesheet, renderMermaid } from "docs-overlay-mermaid";

const css = diagramStylesheet("technical"); // emit once, in a <style> or a stylesheet
const { svg } = await renderMermaid(source, { stylesheet: "external" });
```

`"inline"` stays the default, because an SVG opened on its own has nowhere else to carry its styles.
`scopeOf(theme)` names the class every rule is scoped to, if you need to target it.

One caveat on a React Server Components build, Next.js in particular: the framework emits every element
twice, once as HTML and once in the RSC payload, so the copy you saved is still counted once in each. The
saving is real and it is about half what the byte arithmetic suggests. Measured on the page documenting
this — four diagrams, 227.9 kB down to 202.1 kB, where removing four inlined copies outright would have
been nearer 52 kB.

Every colour is read through a CSS custom property with the theme value as its fallback, so a site
restyles a diagram it did not generate:

```css
:root {
  --docs-overlay-diagram-node-bg: #fff;
  --docs-overlay-diagram-node-border: #e2e8f0;
  --docs-overlay-diagram-fg: #1f2933;
  --docs-overlay-diagram-muted: #5c6b7a;
  --docs-overlay-diagram-edge: #94a3b8;
  --docs-overlay-diagram-accent: #2f6feb;
  --docs-overlay-diagram-group-bg: #f8fafc;
  --docs-overlay-diagram-group-border: #e2e8f0;
  --docs-overlay-diagram-bg: transparent;
}
```

A dark palette ships with the SVG under `prefers-color-scheme: dark`, so a diagram opened straight
from disk is readable either way — and a site with its own theme toggle overrides the properties and
wins over the media query.

## Semantic nodes

```ts
type SemanticNodeType =
  | "person" | "application" | "frontend" | "backend" | "api" | "server"
  | "database" | "cache" | "queue" | "cloud" | "storage" | "service"
  | "component" | "file" | "unknown";
```

Resolved in this order:

1. **What the source states.** `service db(database)[Store]` is a database whatever its label says.
2. **Your rules.**
3. **The defaults** — `Postgres`, `Redis`, `Kafka`, `GraphQL`, `Angular`, `Developer` and so on.
4. **`unknown`**, which is always drawn, never dropped.

The defaults match on word boundaries, and they abstain on a label that reads like prose:
"Database migration guide" is a documentation page, and drawing a disk next to it is worse than
drawing nothing, because a reader trusts the icon.

### Custom rules

```ts
await renderMermaid(source, {
  semantic: {
    rules: [{ match: node => node.id === "payments", type: "service", icon: "credit-card" }]
  },
  icons: extendIconRegistry([{ id: "credit-card", viewBox: "0 0 24 24", content: "<rect …/>" }])
});
```

`semantic.disableDefaults: true` drops the built-in rules entirely.

## Accessibility

Every SVG carries `role="img"`, `aria-labelledby`, a `<title>` and a `<desc>`. `title` and `accDescr`
from the source are used when present; otherwise the description is generated from the relationships,
because a diagram announced only as "image" tells a reader nothing about a drawing whose entire
content is which box connects to which.

```ts
await renderMermaid(source, { accessibility: { title: "…", description: "…" } });
```

## SSR

No `window`, no `document`, no `HTMLElement`, no filesystem, no network — asserted by a test, not just
intended. `<foreignObject>` is never emitted, so the output survives being put in an `<img>`, a PDF or
a thumbnail, which a Mermaid SVG does not.

Text is measured from a glyph-advance table, since without a DOM there is nobody to ask. It runs a few
percent generous on purpose — a box slightly too large looks deliberate, one slightly too small clips
the label. Pass `measureText` to use real metrics where you have them.

## Streaming Markdown

A diagram arriving a few lines at a time is a syntax error at every intermediate step. `tolerant`
renders what parses and drops what does not, so a half-delivered diagram does not take the page down:

```ts
await renderMermaid(partial, { tolerant: true });
```

Debouncing and caching are the caller's; `cache` takes any `get`/`set` pair.

## Fallback

For a diagram type this package does not support, hand it something that does — client-side Mermaid, a
code block, whatever fits. That is what keeps `mermaid` out of this package's dependencies:

```ts
await renderMermaid(source, { fallback: { render: source => ({ svg: asCodeBlock(source), width: 0, height: 0 }) } });
```

## API

```ts
renderMermaid(source, options?): Promise<RenderResult>   // the facade
parseMermaid(source, options?): Promise<MermaidDiagram>  // source → normalized model
enrichMermaid(diagram, options?): SemanticDiagram        // + semantic types and icons
layoutDiagram(diagram, options?): LayoutResult           // + coordinates
renderSvg(layout, options?): RenderResult                // + markup
detectDiagramType(source): MermaidDiagramType            // without parsing
```

`renderMermaid` is only the convenient order to call the others in; every stage is exported so an
integrator can step into the middle of the pipeline. Parsing is asynchronous because Mermaid's Langium
grammar is; the three stages after it are synchronous and pure.

Errors are one class, `MermaidError`, with a `code` from a documented union — switch on the code, not
on `instanceof`.

## Architecture

```text
source
  → DiagramParser        one per dialect: a tokenizer for flowchart, Langium for architecture
      MermaidDiagram     the normalized model — no Mermaid AST past this line
  → enrichMermaid        source metadata → your rules → defaults → unknown
      SemanticDiagram
  → LayoutEngine         dagre for flowchart, a deterministic grid for architecture
      LayoutResult       final coordinates; the renderer decides nothing
  → DiagramRenderer      SVG today
      RenderResult
```

Architecture diagrams are laid out on a grid solved from the side hints the author wrote —
`db:R -- L:server` means "server is to the right of db". Mermaid feeds those to a force-directed
engine, which looks good and is not reproducible; a grid is both simpler and deterministic.

## Relationship to docs-overlay

None, technically: this package does not depend on `docs-overlay` and works on its own in Node, a
browser, a CLI or any static site generator. It lives in that repository to share the build, the
release and the test suite.

## Roadmap

Unnumbered on purpose: the last set of numbers went stale the moment `0.3` shipped.

- a richer icon set, and per-diagram theme overrides
- `sequenceDiagram`, `classDiagram`, `stateDiagram` — a hand-written parser each, since Mermaid ships
  none of them standalone
- an Excalidraw renderer, through the same `DiagramRenderer` seam

## License

MIT
