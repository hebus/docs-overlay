import { describe, expect, it } from "vitest";
import { MermaidError } from "../errors.js";
import type { LayoutNode, LayoutResult } from "../model/layout.js";
import { parseMermaid } from "../parser/registry.js";
import { enrichMermaid } from "../semantic/enrich.js";
import { architectures, flowcharts, regressions } from "../testing/fixtures.js";
import { layoutDiagram } from "./layout.js";

const lay = async (source: string): Promise<LayoutResult> => layoutDiagram(enrichMermaid(await parseMermaid(source)));

const boxOf = (layout: LayoutResult, id: string): LayoutNode => {
  const found = layout.nodes.find(node => node.node.id === id);
  if (found === undefined) throw new Error(`no node ${id}`);
  return found;
};

const overlaps = (a: LayoutNode, b: LayoutNode): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const centreX = (node: LayoutNode): number => node.x + node.width / 2;
const centreY = (node: LayoutNode): number => node.y + node.height / 2;

describe("layoutDiagram", () => {
  it("refuses a diagram type no engine handles", () => {
    const empty = { type: "sequence", direction: "LR", nodes: [], edges: [], groups: [], alignments: [] } as const;
    expect(() => layoutDiagram(empty)).toThrow(MermaidError);
    expect(() => layoutDiagram(empty)).toThrow(/No layout engine/);
  });

  it.each(["lr", "tb"] as const)("keeps every node inside the canvas (%s)", async key => {
    const layout = await lay(flowcharts[key]);
    for (const node of layout.nodes) {
      expect(node.x, node.node.id).toBeGreaterThanOrEqual(0);
      expect(node.y, node.node.id).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width, node.node.id).toBeLessThanOrEqual(layout.width);
      expect(node.y + node.height, node.node.id).toBeLessThanOrEqual(layout.height);
    }
  });

  it("never overlaps two nodes", async () => {
    for (const source of [flowcharts.lr, flowcharts.subgraphs, architectures.nested, architectures.junction]) {
      const layout = await lay(source);
      for (let i = 0; i < layout.nodes.length; i += 1) {
        for (let j = i + 1; j < layout.nodes.length; j += 1) {
          const a = layout.nodes[i];
          const b = layout.nodes[j];
          if (a === undefined || b === undefined) continue;
          expect(overlaps(a, b), `${a.node.id} overlaps ${b.node.id}`).toBe(false);
        }
      }
    }
  });

  /*
   * Determinism is not a nicety here: it is why this package does its own architecture layout instead
   * of handing the side hints to a force-directed engine the way Mermaid does. Every snapshot in the
   * suite, and every diff a documentation site produces on rebuild, depends on it.
   */
  it("produces the same coordinates twice", async () => {
    for (const source of [flowcharts.lr, architectures.nested, architectures.aligned]) {
      const first = await lay(source);
      const second = await lay(source);
      expect(JSON.stringify(second.nodes)).toBe(JSON.stringify(first.nodes));
      expect(JSON.stringify(second.edges)).toBe(JSON.stringify(first.edges));
      expect([second.width, second.height]).toEqual([first.width, first.height]);
    }
  });

  it("lays a flowchart out along its stated direction", async () => {
    const lr = await lay("flowchart LR\n A --> B");
    expect(centreX(boxOf(lr, "B"))).toBeGreaterThan(centreX(boxOf(lr, "A")));

    const rl = await lay("flowchart RL\n A --> B");
    expect(centreX(boxOf(rl, "B"))).toBeLessThan(centreX(boxOf(rl, "A")));

    const tb = await lay("flowchart TB\n A --> B");
    expect(centreY(boxOf(tb, "B"))).toBeGreaterThan(centreY(boxOf(tb, "A")));

    const bt = await lay("flowchart BT\n A --> B");
    expect(centreY(boxOf(bt, "B"))).toBeLessThan(centreY(boxOf(bt, "A")));
  });

  it("wraps a subgraph box around its members", async () => {
    const layout = await lay(flowcharts.subgraphs);
    const core = layout.groups.find(group => group.group.id === "core");
    const api = boxOf(layout, "API");
    expect(core).toBeDefined();
    expect(api.x).toBeGreaterThanOrEqual(core?.x ?? 0);
    expect(api.x + api.width).toBeLessThanOrEqual((core?.x ?? 0) + (core?.width ?? 0));
    expect(api.y).toBeGreaterThanOrEqual(core?.y ?? 0);
  });

  it("nests a group box inside its parent's", async () => {
    const layout = await lay(architectures.nested);
    const platform = layout.groups.find(group => group.group.id === "platform");
    const data = layout.groups.find(group => group.group.id === "data");
    expect(platform).toBeDefined();
    expect(data).toBeDefined();
    expect(data?.x ?? 0).toBeGreaterThanOrEqual(platform?.x ?? 0);
    expect((data?.x ?? 0) + (data?.width ?? 0)).toBeLessThanOrEqual((platform?.x ?? 0) + (platform?.width ?? 0));
    expect(data?.depth).toBe(1);
    expect(platform?.depth).toBe(0);
  });

  /*
   * `db:L -- R:server` says the edge leaves db's left side, so server is to db's *left*. Honouring
   * this is the entire justification for the grid: dagre would rank db before server from the edge
   * direction and put it on the wrong side.
   */
  it("honours an architecture side hint", async () => {
    const layout = await lay(architectures.basic);
    expect(centreX(boxOf(layout, "server"))).toBeLessThan(centreX(boxOf(layout, "db")));
  });

  it("honours a hint that points downwards", async () => {
    const layout = await lay("architecture-beta\n service top(server)[Top]\n service under(server)[Under]\n top:B --> T:under");
    expect(centreY(boxOf(layout, "under"))).toBeGreaterThan(centreY(boxOf(layout, "top")));
  });

  it("puts an aligned row on one row", async () => {
    const layout = await lay(architectures.aligned);
    expect(centreY(boxOf(layout, "b"))).toBe(centreY(boxOf(layout, "c")));
  });

  it("routes an architecture edge orthogonally, through explicit bends", async () => {
    const layout = await lay(architectures.aligned);
    for (const edge of layout.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
      // Every leg is horizontal or vertical: a diagonal would mean the side hint was thrown away.
      for (let index = 1; index < edge.points.length; index += 1) {
        const from = edge.points[index - 1];
        const to = edge.points[index];
        if (from === undefined || to === undefined) continue;
        expect(Math.abs(from.x - to.x) < 0.01 || Math.abs(from.y - to.y) < 0.01).toBe(true);
      }
    }
  });

  it("gives an edge label a box on the route", async () => {
    const layout = await lay(flowcharts.edgeLabels);
    const labelled = layout.edges.filter(edge => edge.label !== undefined);
    expect(labelled).toHaveLength(4);
    for (const edge of labelled) {
      expect(edge.label?.width).toBeGreaterThan(0);
      expect(edge.label?.height).toBeGreaterThan(0);
    }
  });

  it("places a disconnected node rather than dropping it", async () => {
    const layout = await lay("architecture-beta\n service a(server)[A]\n service lonely(server)[Lonely]");
    expect(layout.nodes.map(node => node.node.id).sort()).toEqual(["a", "lonely"]);
    expect(overlaps(boxOf(layout, "a"), boxOf(layout, "lonely"))).toBe(false);
  });

  /*
   * A group box that spans a service it does not contain claims something false about the diagram, and
   * a reader believes the box before they re-read the labels.
   */
  it("keeps a group box off a service that is not in it", async () => {
    const layout = await lay(regressions.groupWithUnconnectedMember);
    const box = layout.groups.find(group => group.group.id === "g");
    const outsider = boxOf(layout, "out");
    expect(box).toBeDefined();
    expect(box === undefined ? false : overlaps({ ...box, node: outsider.node, label: outsider.label }, outsider)).toBe(false);
  });

  it("stacks an unconnected group member beside its sibling instead of starting a new component", async () => {
    const layout = await lay(regressions.groupWithUnconnectedMember);
    // `b` has no edge, so nothing but its group tells the layout where it belongs: under `a`, across
    // the flow, rather than off to the right past everything else.
    expect(centreX(boxOf(layout, "b"))).toBe(centreX(boxOf(layout, "a")));
    expect(centreY(boxOf(layout, "b"))).toBeGreaterThan(centreY(boxOf(layout, "a")));
  });

  it("stacks several isolated siblings rather than piling them on one cell", async () => {
    const layout = await lay(`architecture-beta
      group g(cloud)[Group]
      service a(server)[A] in g
      service b(server)[B] in g
      service c(server)[C] in g
      service out(server)[Out]
      a:R --> L:out`);
    const column = ["a", "b", "c"].map(id => boxOf(layout, id));
    expect(new Set(column.map(centreX)).size).toBe(1);
    expect(new Set(column.map(centreY)).size).toBe(3);
  });

  /*
   * The same symptom, deliberately left alone. The hints order `mid` between two members of `g`, so no
   * layout can both honour them and keep the box tight. The box wins because the alternative is an
   * arrow pointing the wrong way, and a reversed arrow misleads more than a wide box. This test exists
   * so the choice is visible rather than rediscovered as a bug.
   */
  it("still spans a non-member when the hints leave no correct answer", async () => {
    const layout = await lay(regressions.groupSplitByHints);
    expect(centreX(boxOf(layout, "mid"))).toBeGreaterThan(centreX(boxOf(layout, "a")));
    expect(centreX(boxOf(layout, "far"))).toBeGreaterThan(centreX(boxOf(layout, "mid")));
  });

  it("sizes a node to fit its label", async () => {
    const layout = await lay('flowchart LR\n A["A very much longer label than the other"] --> B["B"]');
    expect(boxOf(layout, "A").width).toBeGreaterThan(boxOf(layout, "B").width);
  });

  it("uses a supplied measurer for sizing", async () => {
    const diagram = enrichMermaid(await parseMermaid("flowchart LR\n A[Wide] --> B[Wide]"));
    const narrow = layoutDiagram(diagram, { measureText: () => 10 });
    const wide = layoutDiagram(diagram, { measureText: () => 400 });
    expect(wide.width).toBeGreaterThan(narrow.width);
  });
});
