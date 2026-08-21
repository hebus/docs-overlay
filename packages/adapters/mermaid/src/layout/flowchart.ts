/**
 * Flowchart layout, delegated to dagre. Writing another layered-graph algorithm would be a month of
 * work to arrive somewhere behind it, and Mermaid itself ranks flowcharts with a dagre fork.
 *
 * `@dagrejs/dagre` rather than the `dagre-d3-es` Mermaid uses: same algorithm, no d3, no DOM. Its
 * typings are deliberately loose (`Graph<any, any, any>`), so everything read back out of the graph
 * goes through a narrow local interface instead of being trusted as-is.
 */

import { Graph, layout as runDagre } from "@dagrejs/dagre";
import type { LayoutEdge, LayoutGroup, LayoutNode, LayoutResult, MeasuredLabel, Point } from "../model/layout.js";
import type { SemanticDiagram } from "../model/semantic.js";
import type { DiagramTheme } from "../themes/theme.js";
import type { MeasureText } from "./measure-text.js";
import { measureLabel } from "./measure-text.js";
import { sizeNode } from "./node-size.js";

/** What dagre writes back. Centre coordinates, not corners. */
interface PlacedNode {
  readonly x?: number | undefined;
  readonly y?: number | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
}

interface PlacedEdge {
  readonly points?: readonly Point[] | undefined;
  readonly x?: number | undefined;
  readonly y?: number | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
}

export interface FlowchartLayoutOptions {
  readonly theme: DiagramTheme;
  readonly measure?: MeasureText | undefined;
}

export function layoutFlowchart(diagram: SemanticDiagram, options: FlowchartLayoutOptions): LayoutResult {
  const { theme } = options;
  const graph = new Graph({ compound: true, multigraph: true, directed: true });

  graph.setGraph({
    rankdir: diagram.direction,
    nodesep: theme.spacing.nodeGap,
    ranksep: theme.spacing.rankGap,
    marginx: theme.spacing.margin,
    marginy: theme.spacing.margin
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const labels = new Map<string, MeasuredLabel>();
  for (const node of diagram.nodes) {
    const sized = sizeNode(node, theme, options.measure);
    labels.set(node.id, sized.label);
    graph.setNode(node.id, { width: sized.width, height: sized.height });
  }

  const groupLabels = new Map<string, MeasuredLabel>();
  for (const group of diagram.groups) {
    const label = measureLabel(group.label ?? "", {
      fontSize: theme.text.groupFontSize,
      lineHeight: theme.text.lineHeight,
      maxWidth: Number.POSITIVE_INFINITY,
      measure: options.measure
    });
    groupLabels.set(group.id, label);
    // Padding is applied by hand below: dagre keeps a cluster's members together, which is the part
    // worth having, but it does not reserve room for a title bar.
    graph.setNode(group.id, {});
  }

  for (const group of diagram.groups) if (group.parent !== undefined) graph.setParent(group.id, group.parent);
  for (const node of diagram.nodes) if (node.group !== undefined) graph.setParent(node.id, node.group);

  diagram.edges.forEach((edge, index) => {
    const label = edge.label === undefined ? {} : measuredEdgeLabel(edge.label, theme, options.measure);
    graph.setEdge(edge.source, edge.target, label, String(index));
  });

  runDagre(graph);

  const nodes: LayoutNode[] = diagram.nodes.map(node => {
    const placed = graph.node(node.id) as PlacedNode | undefined;
    const width = placed?.width ?? 0;
    const height = placed?.height ?? 0;
    return {
      node,
      label: labels.get(node.id) ?? { lines: [], width: 0, height: 0 },
      x: (placed?.x ?? 0) - width / 2,
      y: (placed?.y ?? 0) - height / 2,
      width,
      height
    };
  });

  // dagre sizes clusters itself — it reserves the room and keeps members inside — so the box comes
  // from it rather than from a bounding box over the members, which would have been a guess that
  // happened to be right. Only the title bar is added, because dagre knows nothing about one.
  const depths = new Map(diagram.groups.map(group => [group.id, depthOf(group.id, diagram)]));
  const groups: LayoutGroup[] = diagram.groups
    .map(group => {
      const placed = graph.node(group.id) as PlacedNode | undefined;
      if (placed?.width === undefined || placed.height === undefined) return undefined;
      const header = theme.group.headerHeight;
      return {
        group,
        label: groupLabels.get(group.id) ?? { lines: [], width: 0, height: 0 },
        depth: depths.get(group.id) ?? 0,
        x: (placed.x ?? 0) - placed.width / 2,
        y: (placed.y ?? 0) - placed.height / 2 - header,
        width: placed.width,
        height: placed.height + header
      };
    })
    .filter((group): group is LayoutGroup => group !== undefined);

  const edges: LayoutEdge[] = diagram.edges.map((edge, index) => {
    const placed = graph.edge({ v: edge.source, w: edge.target, name: String(index) }) as PlacedEdge | undefined;
    const points = placed?.points ?? [];
    return {
      edge,
      points: points.length >= 2 ? points.map(point => ({ x: point.x, y: point.y })) : fallbackRoute(edge.source, edge.target, nodes),
      label:
        edge.label === undefined || placed?.x === undefined
          ? undefined
          : {
              text: edge.label,
              x: placed.x - (placed.width ?? 0) / 2,
              y: (placed.y ?? 0) - (placed.height ?? 0) / 2,
              width: placed.width ?? 0,
              height: placed.height ?? 0
            }
    };
  });

  return normalize(diagram, nodes, edges, groups, theme);
}

function measuredEdgeLabel(text: string, theme: DiagramTheme, measure: MeasureText | undefined): { width: number; height: number; labelpos: "c" } {
  const label = measureLabel(text, {
    fontSize: theme.text.edgeFontSize,
    lineHeight: theme.text.lineHeight,
    maxWidth: theme.node.maxLabelWidth,
    measure
  });
  return { width: label.width + theme.edge.labelPaddingX * 2, height: label.height + theme.edge.labelPaddingY * 2, labelpos: "c" };
}

/** A straight line between two centres. Only reached if dagre routed nothing, which self-edges can do. */
function fallbackRoute(source: string, target: string, nodes: readonly LayoutNode[]): readonly Point[] {
  const from = nodes.find(node => node.node.id === source);
  const to = nodes.find(node => node.node.id === target);
  if (from === undefined || to === undefined) return [];
  return [
    { x: from.x + from.width / 2, y: from.y + from.height / 2 },
    { x: to.x + to.width / 2, y: to.y + to.height / 2 }
  ];
}

function depthOf(groupId: string, diagram: SemanticDiagram): number {
  let depth = 0;
  let current = diagram.groups.find(group => group.id === groupId)?.parent;
  while (current !== undefined) {
    depth += 1;
    current = diagram.groups.find(group => group.id === current)?.parent;
  }
  return depth;
}

/**
 * Shifts everything so the top-left of the drawing is the margin, then reports the size. Group boxes
 * are grown by hand above and can therefore stick out past what dagre thought the canvas was.
 */
function normalize(
  diagram: SemanticDiagram,
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  groups: readonly LayoutGroup[],
  theme: DiagramTheme
): LayoutResult {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const node of nodes) {
    xs.push(node.x, node.x + node.width);
    ys.push(node.y, node.y + node.height);
  }
  for (const group of groups) {
    xs.push(group.x, group.x + group.width);
    ys.push(group.y, group.y + group.height);
  }
  for (const edge of edges) {
    for (const point of edge.points) {
      xs.push(point.x);
      ys.push(point.y);
    }
    if (edge.label !== undefined) {
      xs.push(edge.label.x, edge.label.x + edge.label.width);
      ys.push(edge.label.y, edge.label.y + edge.label.height);
    }
  }

  const margin = theme.spacing.margin;
  const dx = margin - (xs.length === 0 ? 0 : Math.min(...xs));
  const dy = margin - (ys.length === 0 ? 0 : Math.min(...ys));

  const shifted = shift(nodes, edges, groups, dx, dy);

  return {
    type: diagram.type,
    direction: diagram.direction,
    title: diagram.title,
    description: diagram.description,
    width: Math.round((xs.length === 0 ? 0 : Math.max(...xs)) + dx + margin),
    height: Math.round((ys.length === 0 ? 0 : Math.max(...ys)) + dy + margin),
    ...shifted
  };
}

export function shift(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  groups: readonly LayoutGroup[],
  dx: number,
  dy: number
): { readonly nodes: readonly LayoutNode[]; readonly edges: readonly LayoutEdge[]; readonly groups: readonly LayoutGroup[] } {
  const round = (value: number): number => Math.round(value * 100) / 100;
  return {
    nodes: nodes.map(node => ({ ...node, x: round(node.x + dx), y: round(node.y + dy) })),
    groups: groups.map(group => ({ ...group, x: round(group.x + dx), y: round(group.y + dy) })),
    edges: edges.map(edge => ({
      ...edge,
      points: edge.points.map(point => ({ x: round(point.x + dx), y: round(point.y + dy) })),
      label: edge.label === undefined ? undefined : { ...edge.label, x: round(edge.label.x + dx), y: round(edge.label.y + dy) }
    }))
  };
}
