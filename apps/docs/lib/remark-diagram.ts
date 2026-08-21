import { renderMermaid } from "docs-overlay-mermaid";

/**
 * Turns a fenced `mermaid` block into a rendered SVG, at build time.
 *
 * A remark plugin rather than a rehype one, and rather than a `pre` override in the components map,
 * because both of those run *after* Shiki has already turned the fence into styled spans — the raw
 * Mermaid source is only still available this early.
 *
 * The result is an `mdxJsxFlowElement` carrying the SVG as a string, not an mdast `html` node: MDX
 * parses raw HTML as JSX, and the stylesheet inside the SVG is full of `{`, which JSX reads as an
 * expression. The component on the other end is a server component, so nothing ships to the reader.
 */

interface MdastNode {
  readonly type: string;
  readonly lang?: string | null | undefined;
  readonly value?: string | undefined;
  children?: MdastNode[];
}

interface Fence {
  readonly siblings: MdastNode[];
  readonly index: number;
  readonly source: string;
}

export function remarkDiagram(): (tree: MdastNode) => Promise<void> {
  return async tree => {
    const fences: Fence[] = [];

    const walk = (node: MdastNode): void => {
      const children = node.children;
      if (children === undefined) return;
      for (const [index, child] of children.entries()) {
        if (child.type === "code" && child.lang === "mermaid" && typeof child.value === "string") {
          fences.push({ siblings: children, index, source: child.value });
        } else {
          walk(child);
        }
      }
    };

    walk(tree);

    // Sequentially: rendering is pure and fast, and a diagram that fails should name the fence that
    // failed rather than surfacing as one of several rejected promises.
    for (const fence of fences) {
      const { svg, width, height } = await renderMermaid(fence.source, { theme: "technical" });
      fence.siblings[fence.index] = {
        type: "mdxJsxFlowElement",
        name: "Diagram",
        attributes: [
          { type: "mdxJsxAttribute", name: "svg", value: svg },
          { type: "mdxJsxAttribute", name: "width", value: String(width) },
          { type: "mdxJsxAttribute", name: "height", value: String(height) },
          { type: "mdxJsxAttribute", name: "source", value: fence.source }
        ],
        children: []
      } as MdastNode;
    }
  };
}
