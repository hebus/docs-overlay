/**
 * The semantic model: what a node *is*, not what it looks like. "PostgreSQL" is a database, and a
 * renderer can therefore draw it as one — that judgement is made once, here, instead of being
 * re-derived by every theme.
 *
 * Edges and groups are unchanged by enrichment, so they are aliases rather than copies: a second
 * identical interface would only invite the two to drift.
 */

import type { DiagramAlignment, DiagramDirection, MermaidDiagramType, MermaidEdge, MermaidGroup, MermaidNode, NodeShape } from "./diagram.js";

export type SemanticNodeType =
  | "person"
  | "application"
  | "frontend"
  | "backend"
  | "api"
  | "server"
  | "database"
  | "cache"
  | "queue"
  | "cloud"
  | "storage"
  | "service"
  | "component"
  | "file"
  /** Always supported, and always rendered: an unrecognised node is drawn plainly, never dropped. */
  | "unknown";

export interface SemanticNode {
  readonly id: string;
  readonly label: string;
  readonly shape: NodeShape;
  readonly classNames: readonly string[];
  readonly group?: string | undefined;
  readonly type: SemanticNodeType;
  /** Registry name, resolved. `undefined` means "draw the box, no icon". */
  readonly icon?: string | undefined;
}

export type SemanticEdge = MermaidEdge;

export type SemanticGroup = MermaidGroup;

export interface SemanticDiagram {
  readonly type: MermaidDiagramType;
  readonly direction: DiagramDirection;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly nodes: readonly SemanticNode[];
  readonly edges: readonly SemanticEdge[];
  readonly groups: readonly SemanticGroup[];
  readonly alignments: readonly DiagramAlignment[];
}

/**
 * A rule reads the normalized node — never the semantic one — so user rules and default rules see
 * exactly the same input and their order is the only thing that decides.
 */
export interface SemanticRule {
  match: (node: MermaidNode) => boolean;
  readonly type: SemanticNodeType;
  readonly icon?: string | undefined;
}

export interface SemanticOptions {
  readonly rules?: readonly SemanticRule[] | undefined;
  readonly disableDefaults?: boolean | undefined;
}
