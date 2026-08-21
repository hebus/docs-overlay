/**
 * How big a node is. Shared by both layout engines, because a box that changes size depending on
 * which engine placed it would make the two impossible to compare — and because this is where the
 * semantic type stops being metadata and starts costing pixels: a node with an icon is wider.
 *
 * Diamonds and hexagons get extra width on purpose. Their outline cuts the corners off the text box,
 * so a label that fits a rectangle of the same size does not fit them.
 */

import type { MeasuredLabel } from "../model/layout.js";
import type { SemanticNode } from "../model/semantic.js";
import type { DiagramTheme } from "../themes/theme.js";
import type { MeasureText } from "./measure-text.js";
import { measureLabel } from "./measure-text.js";

export interface SizedNode {
  readonly width: number;
  readonly height: number;
  readonly label: MeasuredLabel;
}

/** Widening factors for outlines that waste the corners of their bounding box. */
const SLACK: Readonly<Record<string, number>> = { rhombus: 1.5, hexagon: 1.2, circle: 1.15, stadium: 1.1 };

export function iconOf(node: SemanticNode, theme: DiagramTheme): string | undefined {
  // The theme's veto comes first: the semantic stage has already written a name onto the node, so
  // emptying `semanticTypes` would not have been enough to stop an icon being drawn.
  if (theme.node.icons === false) return undefined;
  return node.icon ?? theme.semanticTypes[node.type].icon;
}

/**
 * How much room the icon occupies, plate included. Shared with the renderer on purpose: if the two
 * disagreed by a pixel the icon would sit off-centre in a box sized for a different icon.
 */
export function iconExtent(theme: DiagramTheme): number {
  const plate = theme.node.iconPlate;
  return plate === undefined ? theme.node.iconSize : theme.node.iconSize + plate.padding * 2;
}

export function sizeNode(node: SemanticNode, theme: DiagramTheme, measure?: MeasureText): SizedNode {
  const { node: box, text } = theme;

  if (node.shape === "junction") {
    const side = box.junctionRadius * 2;
    return { width: side, height: side, label: { lines: [], width: 0, height: 0 } };
  }

  const label = measureLabel(node.label, {
    fontSize: text.fontSize,
    lineHeight: text.lineHeight,
    maxWidth: box.maxLabelWidth,
    measure
  });

  const hasIcon = iconOf(node, theme) !== undefined;
  const extent = iconExtent(theme);

  // An `architecture-beta` service stacks its icon above its label; every other shape puts it beside.
  if (node.shape === "service") {
    const width = Math.max(box.minWidth, Math.max(label.width, extent) + box.paddingX * 2);
    const height = box.paddingY * 2 + (hasIcon ? extent + box.iconGap : 0) + label.height;
    return { width: round(width), height: round(Math.max(box.minHeight, height)), label };
  }

  const inner = label.width + (hasIcon ? extent + box.iconGap : 0);
  const slack = SLACK[node.shape] ?? 1;
  const width = Math.max(box.minWidth, (inner + box.paddingX * 2) * slack);
  const height = Math.max(box.minHeight, Math.max(label.height, hasIcon ? extent : 0) + box.paddingY * 2);

  if (node.shape === "circle") {
    const side = Math.max(width, height);
    return { width: round(side), height: round(side), label };
  }

  return { width: round(width), height: round(height), label };
}

/**
 * Half-pixel grid. Coordinates have to be stable across runs for the snapshots to mean anything, and
 * whole pixels also stop a one-pixel border straddling two device pixels and rendering blurry.
 */
function round(value: number): number {
  return Math.round(value);
}
