/**
 * Normalized model to semantic model. The priority order is the contract, and it is the reason this
 * is a separate stage rather than a lookup inside the renderer:
 *
 *     what the source states  →  user rules  →  default rules  →  unknown
 *
 * A user rule beating a default one is what makes the defaults safe to be opinionated about. And
 * `unknown` is never a failure: the node is drawn plainly, because a diagram that silently loses a
 * box is worse than one with a dull box in it.
 */

import type { MermaidDiagram } from "../model/diagram.js";
import type { SemanticDiagram, SemanticNode, SemanticOptions, SemanticRule } from "../model/semantic.js";
import { defaultRules, ICON_TYPES } from "./default-rules.js";

export function enrichMermaid(diagram: MermaidDiagram, options: SemanticOptions = {}): SemanticDiagram {
  const rules: readonly SemanticRule[] = [...(options.rules ?? []), ...(options.disableDefaults === true ? [] : defaultRules)];

  const nodes: readonly SemanticNode[] = diagram.nodes.map(node => {
    // A junction is a bend in a line. It has no label to read and nothing to be.
    if (node.shape === "junction") return { ...node, type: "unknown", icon: undefined };

    if (node.icon !== undefined) return { ...node, type: ICON_TYPES[node.icon] ?? "service", icon: node.icon };

    for (const rule of rules) {
      if (!rule.match(node)) continue;
      return { ...node, type: rule.type, icon: rule.icon };
    }

    return { ...node, type: "unknown", icon: undefined };
  });

  return {
    type: diagram.type,
    direction: diagram.direction,
    title: diagram.title,
    description: diagram.description,
    nodes,
    edges: diagram.edges,
    groups: diagram.groups,
    alignments: diagram.alignments
  };
}
