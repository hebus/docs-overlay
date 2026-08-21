/**
 * Architecture layout: a grid solved from the side hints the author already wrote.
 *
 * `db:R -- L:server` says "server sits to the right of db". That is a placement constraint, not a
 * suggestion, and dagre has nowhere to put it — it ranks by edge direction and would ignore the side
 * entirely. Mermaid's own renderer feeds these to cytoscape-fcose, a force-directed engine: it looks
 * good and it is not reproducible, so the same source can come out different twice. Determinism is
 * the harder requirement here, and a grid gives it for free.
 *
 * The algorithm: breadth-first from the first declared node of each connected component, each hinted
 * edge placing its target one cell away in the hinted direction; a taken cell pushes the newcomer
 * further along the same axis. Components are then packed left to right. Column widths and row
 * heights come from the largest node in each, so heterogeneous boxes do not force a square grid.
 */

import type { EdgeSide, MermaidEdge } from "../model/diagram.js";
import type { LayoutEdge, LayoutGroup, LayoutNode, LayoutResult, Point } from "../model/layout.js";
import type { SemanticDiagram, SemanticNode } from "../model/semantic.js";
import type { DiagramTheme } from "../themes/theme.js";
import { shift } from "./flowchart.js";
import type { MeasureText } from "./measure-text.js";
import { measureLabel } from "./measure-text.js";
import { sizeNode } from "./node-size.js";

export interface ArchitectureLayoutOptions {
  readonly theme: DiagramTheme;
  readonly measure?: MeasureText | undefined;
}

interface Cell {
  col: number;
  row: number;
}

const STEP: Readonly<Record<EdgeSide, readonly [number, number]>> = { R: [1, 0], L: [-1, 0], B: [0, 1], T: [0, -1] };
const OPPOSITE: Readonly<Record<EdgeSide, EdgeSide>> = { R: "L", L: "R", T: "B", B: "T" };

/**
 * The direction an edge pushes its target. The source's own side is the authority; failing that, the
 * target's side read backwards ("enters from the left" means "is to the right"); failing both, the
 * diagram direction, so an unhinted edge still spreads rather than piling up.
 */
function pushOf(edge: MermaidEdge, fallback: EdgeSide): EdgeSide {
  if (edge.sourceSide !== undefined) return edge.sourceSide;
  if (edge.targetSide !== undefined) return OPPOSITE[edge.targetSide];
  return fallback;
}

export function layoutArchitecture(diagram: SemanticDiagram, options: ArchitectureLayoutOptions): LayoutResult {
  const { theme } = options;
  const fallback: EdgeSide = diagram.direction === "TB" ? "B" : diagram.direction === "BT" ? "T" : diagram.direction === "RL" ? "L" : "R";

  const sized = new Map(diagram.nodes.map(node => [node.id, sizeNode(node, theme, options.measure)]));
  const placeable = diagram.nodes.filter(node => sized.has(node.id));

  // Edges between two real nodes drive placement; a group endpoint is drawn to the group box, which
  // is derived from its members and therefore cannot also constrain them.
  const byId = new Map(placeable.map(node => [node.id, node]));
  const structural = diagram.edges.filter(edge => byId.has(edge.source) && byId.has(edge.target) && edge.sourceIsGroup !== true && edge.targetIsGroup !== true);

  const cells = solveGrid(placeable, structural, fallback);
  applyAlignments(diagram, cells);

  const columns = extent(cells, sized, "col");
  const rows = extent(cells, sized, "row");
  const columnX = offsets(columns, theme.spacing.rankGap, theme.spacing.margin);
  const rowY = offsets(rows, theme.spacing.nodeGap, theme.spacing.margin);

  const nodes: LayoutNode[] = placeable.map(node => {
    const cell = cells.get(node.id) ?? { col: 0, row: 0 };
    const box = sized.get(node.id) ?? { width: 0, height: 0, label: { lines: [], width: 0, height: 0 } };
    const cellWidth = columns.get(cell.col) ?? box.width;
    const cellHeight = rows.get(cell.row) ?? box.height;
    return {
      node,
      label: box.label,
      // Centred in its cell, so a small node between two big ones still lines up with their middles.
      x: (columnX.get(cell.col) ?? 0) + (cellWidth - box.width) / 2,
      y: (rowY.get(cell.row) ?? 0) + (cellHeight - box.height) / 2,
      width: box.width,
      height: box.height
    };
  });

  const groups = boxGroups(diagram, nodes, theme, options.measure);
  const edges = diagram.edges.map(edge => route(edge, nodes, groups, fallback, theme, options.measure));

  const xs = [...nodes.map(n => n.x + n.width), ...groups.map(g => g.x + g.width)];
  const ys = [...nodes.map(n => n.y + n.height), ...groups.map(g => g.y + g.height)];
  const lefts = [...nodes.map(n => n.x), ...groups.map(g => g.x)];
  const tops = [...nodes.map(n => n.y), ...groups.map(g => g.y)];

  const margin = theme.spacing.margin;
  const dx = margin - (lefts.length === 0 ? 0 : Math.min(...lefts));
  const dy = margin - (tops.length === 0 ? 0 : Math.min(...tops));

  return {
    type: diagram.type,
    direction: diagram.direction,
    title: diagram.title,
    description: diagram.description,
    width: Math.round((xs.length === 0 ? 0 : Math.max(...xs)) + dx + margin),
    height: Math.round((ys.length === 0 ? 0 : Math.max(...ys)) + dy + margin),
    ...shift(nodes, edges, groups, dx, dy)
  };
}

/** Breadth-first placement, one connected component at a time, packed left to right. */
function solveGrid(nodes: readonly SemanticNode[], edges: readonly MermaidEdge[], fallback: EdgeSide): Map<string, Cell> {
  const neighbours = new Map<string, { readonly id: string; readonly push: EdgeSide }[]>();
  for (const node of nodes) neighbours.set(node.id, []);
  for (const edge of edges) {
    const push = pushOf(edge, fallback);
    neighbours.get(edge.source)?.push({ id: edge.target, push });
    neighbours.get(edge.target)?.push({ id: edge.source, push: OPPOSITE[push] });
  }

  /*
   * Members of one group with no edge between them would each start their own connected component and
   * get packed far apart, leaving the group's box spanning whatever ended up between them — a box that
   * claims a service it does not contain.
   *
   * So a node the edge graph never mentions is placed next to a group sibling instead of at the next
   * free component slot, and across the flow rather than along it, so siblings stack instead of
   * lengthening the group and re-creating the problem one column further out.
   *
   * Restricted to nodes of degree zero on purpose. An earlier version chained every member, and it
   * preempted a stated hint: `far` was reached from its sibling before the edge that placed it, and the
   * arrow came out pointing backwards. A node with no edge has no hint to contradict, which is what
   * makes this safe.
   *
   * It therefore cannot repair a source that contradicts itself — hints ordering a non-member between
   * two members leave no correct answer, and the box stays wide. See `regressions.groupSplitByHints`.
   */
  const sideways: EdgeSide = fallback === "R" || fallback === "L" ? "B" : "R";
  const isolated = (id: string): boolean => (neighbours.get(id) ?? []).length === 0;
  const siblingsOf = (id: string): readonly string[] => {
    const group = nodes.find(node => node.id === id)?.group;
    return group === undefined ? [] : nodes.filter(node => node.group === group && node.id !== id).map(node => node.id);
  };

  const cells = new Map<string, Cell>();
  const taken = new Set<string>();
  const key = (cell: Cell): string => `${cell.col}:${cell.row}`;
  let componentOffset = 0;

  for (const seed of nodes) {
    if (cells.has(seed.id)) continue;

    const anchor = isolated(seed.id)
      ? siblingsOf(seed.id)
          .map(id => cells.get(id))
          .find(cell => cell !== undefined)
      : undefined;
    const [scol, srow] = STEP[sideways];
    const start: Cell = anchor === undefined ? { col: componentOffset, row: 0 } : { col: anchor.col + scol, row: anchor.row + srow };
    while (taken.has(key(start))) {
      start.col += scol === 0 ? 0 : scol;
      start.row += srow === 0 ? 1 : srow;
    }
    cells.set(seed.id, { ...start });
    taken.add(key(start));

    const queue = [seed.id];
    const component: string[] = [seed.id];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;
      const from = cells.get(current);
      if (from === undefined) continue;

      for (const link of neighbours.get(current) ?? []) {
        if (cells.has(link.id)) continue;
        const [dcol, drow] = STEP[link.push];
        const cell: Cell = { col: from.col + dcol, row: from.row + drow };
        // Occupied: keep going the same way rather than picking a new direction, so the hint the
        // author wrote still reads correctly even when the exact cell was taken.
        let guard = 0;
        while (taken.has(key(cell)) && guard < 256) {
          cell.col += dcol === 0 ? 1 : dcol;
          cell.row += drow;
          guard += 1;
        }
        cells.set(link.id, cell);
        taken.add(key(cell));
        queue.push(link.id);
        component.push(link.id);
      }
    }

    const rightmost = component.reduce((max, id) => Math.max(max, cells.get(id)?.col ?? 0), componentOffset);
    componentOffset = rightmost + 2;
  }

  return cells;
}

/** `align row a b c` forces a shared row; the first member's row wins and the rest move to it. */
function applyAlignments(diagram: SemanticDiagram, cells: Map<string, Cell>): void {
  for (const alignment of diagram.alignments) {
    const anchor = alignment.ids.map(id => cells.get(id)).find(cell => cell !== undefined);
    if (anchor === undefined) continue;

    for (const id of alignment.ids) {
      const cell = cells.get(id);
      if (cell === undefined || cell === anchor) continue;
      if (alignment.kind === "row") cell.row = anchor.row;
      else cell.col = anchor.col;
    }
  }
}

function extent(
  cells: ReadonlyMap<string, Cell>,
  sized: ReadonlyMap<string, { readonly width: number; readonly height: number }>,
  axis: "col" | "row"
): Map<number, number> {
  const sizes = new Map<number, number>();
  for (const [id, cell] of cells) {
    const box = sized.get(id);
    if (box === undefined) continue;
    const index = axis === "col" ? cell.col : cell.row;
    const size = axis === "col" ? box.width : box.height;
    sizes.set(index, Math.max(sizes.get(index) ?? 0, size));
  }
  return sizes;
}

/** Turns per-track sizes into absolute offsets, leaving `gap` between tracks. */
function offsets(sizes: ReadonlyMap<number, number>, gap: number, start: number): Map<number, number> {
  const result = new Map<number, number>();
  let cursor = start;
  for (const index of [...sizes.keys()].sort((a, b) => a - b)) {
    result.set(index, cursor);
    cursor += (sizes.get(index) ?? 0) + gap;
  }
  return result;
}

/**
 * Group boxes, innermost first so an outer box can wrap the boxes it contains rather than only the
 * nodes. A group whose members ended up scattered gets a box that spans them — visibly wrong, and
 * better than a box that excludes one of its own services.
 */
function boxGroups(diagram: SemanticDiagram, nodes: readonly LayoutNode[], theme: DiagramTheme, measure: MeasureText | undefined): readonly LayoutGroup[] {
  const depth = (id: string): number => {
    let level = 0;
    let current = diagram.groups.find(group => group.id === id)?.parent;
    while (current !== undefined) {
      level += 1;
      current = diagram.groups.find(group => group.id === current)?.parent;
    }
    return level;
  };

  const descendants = (id: string): readonly string[] => {
    const own = diagram.groups.filter(group => group.parent === id).flatMap(group => [group.id, ...descendants(group.id)]);
    return [id, ...own];
  };

  const boxes = new Map<string, LayoutGroup>();
  const ordered = [...diagram.groups].sort((a, b) => depth(b.id) - depth(a.id));

  for (const group of ordered) {
    const family = new Set(descendants(group.id));
    const members = nodes.filter(node => node.node.group !== undefined && family.has(node.node.group));
    const inner = [...boxes.values()].filter(box => box.group.parent === group.id);
    if (members.length === 0 && inner.length === 0) continue;

    const lefts = [...members.map(m => m.x), ...inner.map(b => b.x)];
    const rights = [...members.map(m => m.x + m.width), ...inner.map(b => b.x + b.width)];
    const tops = [...members.map(m => m.y), ...inner.map(b => b.y)];
    const bottoms = [...members.map(m => m.y + m.height), ...inner.map(b => b.y + b.height)];

    const pad = theme.group.padding;
    const label = measureLabel(group.label ?? "", {
      fontSize: theme.text.groupFontSize,
      lineHeight: theme.text.lineHeight,
      maxWidth: Number.POSITIVE_INFINITY,
      measure
    });

    const x = Math.min(...lefts) - pad;
    const y = Math.min(...tops) - pad - theme.group.headerHeight;
    boxes.set(group.id, {
      group,
      label,
      depth: depth(group.id),
      x,
      y,
      width: Math.max(Math.max(...rights) + pad - x, label.width + pad * 2),
      height: Math.max(...bottoms) + pad - y
    });
  }

  // Outermost first, so the renderer paints a parent before the child that sits on top of it.
  return [...boxes.values()].sort((a, b) => a.depth - b.depth);
}

/**
 * Orthogonal route between two anchors. The source's side decides whether the line leaves sideways or
 * vertically, which is the whole reason the author wrote it — a straight diagonal would throw it away.
 */
function route(
  edge: MermaidEdge,
  nodes: readonly LayoutNode[],
  groups: readonly LayoutGroup[],
  fallback: EdgeSide,
  theme: DiagramTheme,
  measure: MeasureText | undefined
): LayoutEdge {
  const from = anchorOf(edge.source, edge.sourceIsGroup === true, nodes, groups);
  const to = anchorOf(edge.target, edge.targetIsGroup === true, nodes, groups);
  if (from === undefined || to === undefined) return { edge, points: [], label: undefined };

  const sourceSide = edge.sourceSide ?? inferSide(from, to, fallback);
  const targetSide = edge.targetSide ?? OPPOSITE[sourceSide];

  const start = edgePoint(from, sourceSide);
  const end = edgePoint(to, targetSide);

  const points: Point[] =
    Math.abs(start.x - end.x) < 1 || Math.abs(start.y - end.y) < 1
      ? [start, end]
      : sourceSide === "L" || sourceSide === "R"
        ? [start, { x: end.x, y: start.y }, end]
        : [start, { x: start.x, y: end.y }, end];

  return { edge, points, label: edgeLabel(edge.label, points, theme, measure) };
}

/** Sat on the middle vertex of the route, which for an L-shape is the corner — where a reader looks. */
function edgeLabel(text: string | undefined, points: readonly Point[], theme: DiagramTheme, measure: MeasureText | undefined): LayoutEdge["label"] {
  if (text === undefined || points.length === 0) return undefined;

  const label = measureLabel(text, {
    fontSize: theme.text.edgeFontSize,
    lineHeight: theme.text.lineHeight,
    maxWidth: theme.node.maxLabelWidth,
    measure
  });
  const width = label.width + theme.edge.labelPaddingX * 2;
  const height = label.height + theme.edge.labelPaddingY * 2;
  const first = points[0];
  const last = points[points.length - 1];
  const middle = points[Math.floor(points.length / 2)] ?? first ?? last;
  if (middle === undefined) return undefined;

  return { text, x: middle.x - width / 2, y: middle.y - height / 2, width, height };
}

interface Anchored {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function anchorOf(id: string, isGroup: boolean, nodes: readonly LayoutNode[], groups: readonly LayoutGroup[]): Anchored | undefined {
  if (isGroup) return groups.find(group => group.group.id === id);
  return nodes.find(node => node.node.id === id) ?? groups.find(group => group.group.id === id);
}

function inferSide(from: Anchored, to: Anchored, fallback: EdgeSide): EdgeSide {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "R" : "L";
  return dy >= 0 ? "B" : "T";
}

function edgePoint(box: Anchored, side: EdgeSide): Point {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  if (side === "L") return { x: box.x, y: cy };
  if (side === "R") return { x: box.x + box.width, y: cy };
  if (side === "T") return { x: cx, y: box.y };
  return { x: cx, y: box.y + box.height };
}
