/**
 * Mermaid's architecture AST to the normalized model. This is the whole point of having a normalized
 * model: from here down, nothing knows Langium exists.
 *
 * Two things get validated rather than passed through, because both produce a drawing that lies
 * instead of an error: an edge naming an endpoint nobody declares, and a group nested inside itself.
 */

import type { Architecture } from "@mermaid-js/parser";
import { MermaidError } from "../../errors.js";
import type { DiagramAlignment, EdgeSide, MermaidDiagram, MermaidEdge, MermaidGroup, MermaidNode } from "../../model/diagram.js";

const SIDES: readonly string[] = ["T", "B", "L", "R"];

/** Langium yields `in` as `""` — or leaves it absent — when a service declares no parent. */
function parentOf(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

function sideOf(value: string | undefined): EdgeSide | undefined {
  return value !== undefined && SIDES.includes(value) ? (value as EdgeSide) : undefined;
}

export function normalizeArchitecture(ast: Architecture): MermaidDiagram {
  const nodes: MermaidNode[] = [];
  const children = new Map<string, string[]>();

  const attach = (id: string, parent: string | undefined): void => {
    if (parent === undefined) return;
    const list = children.get(parent);
    if (list === undefined) children.set(parent, [id]);
    else list.push(id);
  };

  for (const group of ast.groups) {
    const parent = parentOf(group.in);
    attach(group.id, parent);
  }

  for (const service of ast.services) {
    const parent = parentOf(service.in);
    nodes.push({
      id: service.id,
      label: service.title ?? service.id,
      shape: "service",
      classNames: [],
      icon: service.icon,
      group: parent
    });
    attach(service.id, parent);
  }

  for (const junction of ast.junctions) {
    const parent = parentOf(junction.in);
    // A junction is a bend, not a thing: no label, and the renderer draws a dot.
    nodes.push({ id: junction.id, label: "", shape: "junction", classNames: [], group: parent });
    attach(junction.id, parent);
  }

  const groups: MermaidGroup[] = ast.groups.map(group => ({
    id: group.id,
    label: group.title ?? group.id,
    icon: group.icon,
    parent: parentOf(group.in),
    children: children.get(group.id) ?? []
  }));

  assertNoGroupCycle(groups);

  const known = new Set<string>([...nodes.map(node => node.id), ...groups.map(group => group.id)]);
  const edges: MermaidEdge[] = ast.edges.map(edge => {
    for (const id of [edge.lhsId, edge.rhsId]) {
      if (!known.has(id)) {
        throw new MermaidError("unknown-edge-endpoint", `The edge endpoint \`${id}\` is not a declared service, group or junction.`, {
          diagramType: "architecture"
        });
      }
    }

    return {
      source: edge.lhsId,
      target: edge.rhsId,
      label: edge.title,
      type: "solid",
      sourceArrow: edge.lhsInto ? "arrow" : "none",
      targetArrow: edge.rhsInto ? "arrow" : "none",
      sourceSide: sideOf(edge.lhsDir),
      targetSide: sideOf(edge.rhsDir),
      sourceIsGroup: edge.lhsGroup,
      targetIsGroup: edge.rhsGroup
    };
  });

  const alignments: DiagramAlignment[] = ast.alignments.map(alignment => ({ kind: alignment.direction, ids: alignment.members }));

  return {
    type: "architecture",
    // Architecture diagrams place by side hints, not by a global flow, so the direction is only the
    // tie-breaker the layout uses when nothing constrains two nodes relative to each other.
    direction: "LR",
    title: ast.title ?? ast.accTitle,
    description: ast.accDescr,
    nodes,
    edges,
    groups,
    alignments
  };
}

function assertNoGroupCycle(groups: readonly MermaidGroup[]): void {
  const parents = new Map(groups.map(group => [group.id, group.parent]));

  for (const group of groups) {
    const seen = new Set<string>([group.id]);
    let current = group.parent;
    while (current !== undefined) {
      if (seen.has(current)) throw new MermaidError("group-cycle", `The group \`${group.id}\` is nested inside itself.`, { diagramType: "architecture" });
      if (!parents.has(current))
        throw new MermaidError("group-cycle", `The group \`${group.id}\` declares an unknown parent \`${current}\`.`, { diagramType: "architecture" });
      seen.add(current);
      current = parents.get(current);
    }
  }
}
