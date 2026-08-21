/**
 * The `<title>` and `<desc>` a screen reader actually reads, and the id suffix everything else in the
 * SVG is namespaced with.
 *
 * A generated description is better than none: a diagram with no `<desc>` is announced as "image",
 * which tells a reader nothing about a drawing whose whole content is the relationships between its
 * boxes. So the fallback spells those relationships out in words. An author who writes `accDescr`
 * always wins over it.
 *
 * The id is a hash of the content, not a counter. A counter would break determinism — the second
 * render of the same diagram would differ from the first — and a fixed string would collide between
 * two diagrams on one page, where a duplicated id is resolved to whichever came first.
 */

import type { LayoutResult } from "../model/layout.js";

export interface AccessibilityOptions {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
}

export interface Described {
  readonly title: string;
  readonly description: string;
  readonly instance: string;
}

/** How many relationships the generated description spells out before summarising the rest. */
const SPELLED_OUT = 12;

export function describe(layout: LayoutResult, options: AccessibilityOptions = {}): Described {
  const title = options.title ?? layout.title ?? defaultTitle(layout);
  const description = options.description ?? layout.description ?? defaultDescription(layout);
  return { title, description, instance: hash(`${layout.type}|${title}|${description}|${layout.width}x${layout.height}`) };
}

function defaultTitle(layout: LayoutResult): string {
  const kind = layout.type === "architecture" ? "Architecture diagram" : "Flowchart";
  const count = layout.nodes.filter(node => node.node.shape !== "junction").length;
  return `${kind} with ${count} ${count === 1 ? "node" : "nodes"}`;
}

function defaultDescription(layout: LayoutResult): string {
  const labelOf = (id: string): string => layout.nodes.find(node => node.node.id === id)?.node.label || id;
  const relations = layout.edges.map(placed => `${labelOf(placed.edge.source)} to ${labelOf(placed.edge.target)}`);

  if (relations.length === 0) {
    const names = layout.nodes.filter(node => node.node.shape !== "junction").map(node => node.node.label || node.node.id);
    return names.length === 0 ? "An empty diagram." : `Unconnected: ${names.join(", ")}.`;
  }

  const listed = relations.slice(0, SPELLED_OUT).join("; ");
  const rest = relations.length - SPELLED_OUT;
  return rest > 0 ? `${listed}; and ${rest} further ${rest === 1 ? "connection" : "connections"}.` : `${listed}.`;
}

/** FNV-1a, base 36. Short enough to read in the markup, and no dependency to get it. */
export function hash(value: string): string {
  let accumulator = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    accumulator ^= value.charCodeAt(index);
    accumulator = Math.imul(accumulator, 0x01000193);
  }
  return (accumulator >>> 0).toString(36);
}
