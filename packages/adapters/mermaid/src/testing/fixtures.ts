/**
 * Fixtures are Mermaid sources as template literals, never `.mmd` files on disk. The package performs
 * no I/O and its tests stay that way — the same rule the engine next door lives by — which also keeps
 * Node's ambient types out of `src/` and makes "this renderer needs no DOM and no filesystem" a
 * checkable claim rather than a stated intention.
 *
 * `regressions` is deliberately empty and deliberately here: every bug found from now on gets a named
 * source in it before it gets a fix.
 */

export const flowcharts = {
  lr: `flowchart LR
    Developer["Developer"] --> App["Angular"]
    App --> API["REST API"]
    API --> DB["PostgreSQL"]
    API --> Cache["Redis"]`,

  tb: `flowchart TB
    A --> B
    B --> C`,

  shapes: `flowchart LR
    r[Rectangle]
    ro(Rounded)
    st([Stadium])
    sub[[Subroutine]]
    cyl[(Cylinder)]
    cir((Circle))
    rh{Rhombus}
    hex{{Hexagon}}`,

  edgeKinds: `flowchart LR
    A --> B
    B --- C
    C -.-> D
    D ==> E
    E --o F
    F --x G
    G <--> H`,

  edgeLabels: `flowchart LR
    A -->|yes| B
    B -- maybe --> C
    C -. later .-> D
    D == heavy ==> E`,

  chain: `flowchart LR
    A --> B --> C --> D`,

  ampersand: `flowchart LR
    A & B --> C & D`,

  /** The pair the tokenizer has to tell apart: a three-node chain, and a two-node labeled link. */
  chainVersusLabel: `flowchart LR
    A --- B --- C
    X-- carries ---Y`,

  subgraphs: `flowchart TB
    subgraph edge [Edge]
      CDN
      subgraph inner [Inner]
        WAF
      end
    end
    subgraph core [Core]
      API
    end
    CDN --> API
    WAF --> CDN`,

  classes: `flowchart LR
    classDef hot fill:#f00
    A[Alpha]:::hot --> B[Beta]
    class B hot`,

  ignored: `flowchart LR
    %% a comment
    A --> B
    style A fill:#eee
    linkStyle 0 stroke:#333
    click A "https://example.com"
    direction LR`,

  quotedLabel: `flowchart LR
    A["Tom &amp; Jerry <script>"] --> B["100%% done"]`,

  prose: `flowchart LR
    guide["Database migration guide"] --> real["PostgreSQL"]`,

  frontmatter: `---
title: With frontmatter
---
flowchart LR
    A --> B`,

  /** What a Markdown stream looks like halfway through delivering a diagram. */
  truncated: `flowchart LR
    A --> B
    B -->`,

  semicolons: `flowchart LR; A --> B; B --> C`
} as const;

export const architectures = {
  basic: `architecture-beta
    group api(cloud)[API]
    service server(server)[Server] in api
    service db(database)[Database] in api
    db:L -- R:server`,

  nested: `architecture-beta
    group platform(cloud)[Platform]
    group data(database)[Data] in platform
    service cache(disk)[Redis] in data
    service store(database)[Postgres] in data
    service web(server)[Web] in platform
    web:R --> L:cache
    cache:R -- L:store`,

  junction: `architecture-beta
    service left(server)[Left]
    junction middle
    service right(server)[Right]
    left:R -- L:middle
    middle:R -- L:right`,

  aligned: `architecture-beta
    service a(server)[A]
    service b(server)[B]
    service c(server)[C]
    a:B --> T:b
    a:B --> T:c
    align row b c`,

  titled: `architecture-beta
    title Payments platform
    accDescr: How a payment flows through the platform
    service gateway(internet)[Gateway]
    service ledger(database)[Ledger]
    gateway:R --> L:ledger`
} as const;

export const unsupported = {
  sequence: `sequenceDiagram
    Alice->>Bob: Hello`,

  classDiagram: `classDiagram
    Animal <|-- Duck`,

  notADiagram: `# Just a heading

Some prose.`
} as const;

/** Every bug becomes a named source here before it becomes a fix. */
export const regressions = {
  /**
   * `user-service --> api-gateway` is idiomatic Mermaid and used to be a syntax error: the id stopped at
   * the hyphen and `-service --> api-gateway` was read as a broken link. Probably the most common thing
   * a real diagram would have hit.
   */
  hyphenatedIds: `flowchart LR
    user-service["User service"] --> api-gateway["Gateway"]
    api-gateway --> user-db["PostgreSQL"]`,

  /**
   * The forms a hyphen must *not* be swallowed by, each of which the fix could have broken: a link with
   * no spaces around it, a dotted one, and a thick one. The dot matters because it is an id character,
   * so the lookahead after a hyphen has to be narrower than the id set itself.
   */
  hyphenAgainstLinks: `flowchart LR
    a-b-->c-d
    x-.->y
    p==>q`,

  /**
   * An unquoted `--` inside an inline label silently produced a phantom node — `A -- a--b --> B` came out
   * as three nodes, `A`, `b` and `B`. Quoting is Mermaid's own escape hatch for a label with special
   * characters, and the scanner now steps over a quoted span instead of finding the `--` inside it.
   */
  dashesInQuotedLabel: `flowchart LR
    A -- "a--b" --> B`,

  /**
   * `b` has no edge at all, so it used to become its own connected component and get packed to the
   * right of `out` — leaving group `g`'s box spanning a service that is not in it. Nothing in the
   * source asks for that: `b` can sit under `a`.
   */
  groupWithUnconnectedMember: `architecture-beta
    group g(cloud)[Group]
    service a(server)[A] in g
    service b(server)[B] in g
    service out(server)[Out]
    a:R --> L:out`,

  /**
   * The same symptom with a different cause, and this one is *not* a bug. The hints say "a, then mid,
   * then far, left to right" while `a` and `far` are grouped and `mid` is not: no layout can honour
   * both. The box spans `mid` because the alternative is an arrow pointing the wrong way, and a
   * reversed arrow is the worse lie.
   */
  groupSplitByHints: `architecture-beta
    group g(cloud)[Group]
    service a(server)[A] in g
    service far(server)[Far] in g
    service mid(server)[Mid]
    a:R --> L:mid
    mid:R --> L:far`
} as const;
