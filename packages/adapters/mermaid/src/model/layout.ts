/**
 * What a layout engine hands a renderer: final coordinates and nothing to decide. A renderer that
 * had to lay anything out would have to be rewritten for every new output format, which is the one
 * thing this split exists to prevent.
 */

import type { DiagramDirection, MermaidDiagramType } from "./diagram.js";
import type { SemanticEdge, SemanticGroup, SemanticNode } from "./semantic.js";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Text already measured and wrapped, so the renderer needs no font metrics of its own. */
export interface MeasuredLabel {
  readonly lines: readonly string[];
  readonly width: number;
  readonly height: number;
}

export interface LayoutNode extends Box {
  readonly node: SemanticNode;
  readonly label: MeasuredLabel;
}

export interface LayoutEdgeLabel extends Box {
  readonly text: string;
}

export interface LayoutEdge {
  readonly edge: SemanticEdge;
  /** At least two points. Bends are explicit so the renderer never invents a route. */
  readonly points: readonly Point[];
  readonly label?: LayoutEdgeLabel | undefined;
}

export interface LayoutGroup extends Box {
  readonly group: SemanticGroup;
  readonly label: MeasuredLabel;
  /** Nesting depth, so a theme can shade an inner group differently without recomputing it. */
  readonly depth: number;
}

export interface LayoutResult {
  readonly type: MermaidDiagramType;
  readonly direction: DiagramDirection;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly LayoutNode[];
  readonly edges: readonly LayoutEdge[];
  readonly groups: readonly LayoutGroup[];
}
