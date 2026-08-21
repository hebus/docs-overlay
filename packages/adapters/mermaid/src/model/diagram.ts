/**
 * The normalized model. Every parser produces this, and nothing downstream ever sees a Mermaid AST:
 * that is what lets `architecture-beta` come from Langium and `flowchart` from a hand-written
 * tokenizer without the layout or the renderer knowing which.
 *
 * Shapes and side hints are kept even when a given dialect cannot express them, so a renderer can
 * read one model rather than branching on `type` for field availability.
 */

export type MermaidDiagramType = "flowchart" | "architecture" | "sequence" | "class" | "state" | "er" | "unknown";

export type DiagramDirection = "LR" | "RL" | "TB" | "BT";

export type NodeShape =
  | "rectangle"
  | "rounded"
  | "stadium"
  | "subroutine"
  | "cylinder"
  | "circle"
  | "rhombus"
  | "hexagon"
  /** An `architecture-beta` service: an icon above a label, not a box around text. */
  | "service"
  /** An `architecture-beta` junction: a bend with no label and no box. */
  | "junction";

export type EdgeType = "solid" | "dotted" | "thick";

export type EdgeArrow = "none" | "arrow" | "circle" | "cross";

/** Which side of a node an edge leaves from. `architecture-beta` states it; flowchart infers it. */
export type EdgeSide = "T" | "B" | "L" | "R";

export interface MermaidNode {
  readonly id: string;
  readonly label: string;
  readonly shape: NodeShape;
  /** `classDef` names, carried opaquely: styling is the theme's business, not the parser's. */
  readonly classNames: readonly string[];
  /** Stated in the source — an `architecture-beta` service icon. Beats every heuristic. */
  readonly icon?: string | undefined;
  readonly group?: string | undefined;
}

export interface MermaidEdge {
  readonly source: string;
  readonly target: string;
  readonly label?: string | undefined;
  readonly type: EdgeType;
  readonly sourceArrow: EdgeArrow;
  readonly targetArrow: EdgeArrow;
  readonly sourceSide?: EdgeSide | undefined;
  readonly targetSide?: EdgeSide | undefined;
  /** `server{group}:B --> T:subnet{group}` — the edge attaches to the group box, not the service. */
  readonly sourceIsGroup?: boolean | undefined;
  readonly targetIsGroup?: boolean | undefined;
}

export interface MermaidGroup {
  readonly id: string;
  readonly label?: string | undefined;
  readonly icon?: string | undefined;
  readonly parent?: string | undefined;
  readonly children: readonly string[];
}

export type AlignmentKind = "row" | "column";

/** `align row a b c` — forces a shared axis the direction hints alone would not guarantee. */
export interface DiagramAlignment {
  readonly kind: AlignmentKind;
  readonly ids: readonly string[];
}

export interface MermaidDiagram {
  readonly type: MermaidDiagramType;
  readonly direction: DiagramDirection;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly nodes: readonly MermaidNode[];
  readonly edges: readonly MermaidEdge[];
  readonly groups: readonly MermaidGroup[];
  readonly alignments: readonly DiagramAlignment[];
}
