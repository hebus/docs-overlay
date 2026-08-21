import { describe, expect, it } from "vitest";
import { MermaidError } from "../../errors.js";
import type { MermaidDiagram } from "../../model/diagram.js";
import { architectures } from "../../testing/fixtures.js";
import { normalizeArchitecture } from "./normalize.js";
import { parseArchitectureAst } from "./parse.js";

const parse = async (source: string): Promise<MermaidDiagram> => normalizeArchitecture(await parseArchitectureAst(source));

describe("parseArchitectureAst", () => {
  it("reports a syntax error as a MermaidError, not a Langium one", async () => {
    await expect(parseArchitectureAst("architecture-beta\n  service (")).rejects.toThrow(MermaidError);
    await expect(parseArchitectureAst("architecture-beta\n  service (")).rejects.toThrow(/Mermaid rejected this architecture diagram/);
  });
});

describe("normalizeArchitecture", () => {
  it("turns services into nodes that keep their stated icon", async () => {
    const diagram = await parse(architectures.basic);
    expect(diagram.type).toBe("architecture");
    expect(diagram.nodes).toEqual([
      { id: "server", label: "Server", shape: "service", classNames: [], icon: "server", group: "api" },
      { id: "db", label: "Database", shape: "service", classNames: [], icon: "database", group: "api" }
    ]);
  });

  it("keeps the side hints, which are the whole reason this layout is not dagre's", async () => {
    const diagram = await parse(architectures.basic);
    expect(diagram.edges.at(0)).toMatchObject({ source: "db", target: "server", sourceSide: "L", targetSide: "R" });
  });

  it("reads an arrow tip from the direction the author pointed it", async () => {
    const diagram = await parse(architectures.nested);
    expect(diagram.edges.at(0)).toMatchObject({ source: "web", target: "cache", sourceArrow: "none", targetArrow: "arrow" });
    expect(diagram.edges.at(1)).toMatchObject({ targetArrow: "none" });
  });

  it("nests groups and lists each one's own children", async () => {
    const diagram = await parse(architectures.nested);
    expect(diagram.groups.map(group => group.id)).toEqual(["platform", "data"]);
    expect(diagram.groups.find(group => group.id === "data")?.parent).toBe("platform");
    expect(diagram.groups.find(group => group.id === "platform")?.children).toEqual(["data", "web"]);
    expect(diagram.groups.find(group => group.id === "data")?.children).toEqual(["cache", "store"]);
  });

  // A junction is a bend in a line, so it gets no label and a shape that tells the renderer to draw a
  // dot. Giving it its id as a label — the flowchart default — would print `middle` in the diagram.
  it("gives a junction no label", async () => {
    const diagram = await parse(architectures.junction);
    const junction = diagram.nodes.find(node => node.id === "middle");
    expect(junction).toMatchObject({ label: "", shape: "junction" });
    expect(junction?.icon).toBeUndefined();
  });

  it("carries alignments through", async () => {
    const diagram = await parse(architectures.aligned);
    expect(diagram.alignments).toEqual([{ kind: "row", ids: ["b", "c"] }]);
  });

  it("reads the title and the accessible description off the source", async () => {
    const diagram = await parse(architectures.titled);
    expect(diagram.title).toBe("Payments platform");
    expect(diagram.description).toBe("How a payment flows through the platform");
  });

  it("leaves a service with no parent ungrouped rather than in an empty group", async () => {
    const diagram = await parse(architectures.junction);
    expect(diagram.nodes.every(node => node.group === undefined)).toBe(true);
  });

  /*
   * Both of these produce a drawing that lies rather than an error, which is why they are checked here
   * instead of being left to the layout: an edge to a name nobody declared would be drawn from
   * nowhere, and a group inside itself recurses while computing its own box.
   */
  it("refuses an edge endpoint nothing declares", async () => {
    await expect(parse("architecture-beta\n  service a(server)[A]\n  a:R -- L:ghost")).rejects.toThrow(/not a declared service, group or junction/);
  });

  it("refuses a group nested inside one that does not exist", async () => {
    await expect(parse("architecture-beta\n  group inner(cloud)[Inner] in nowhere\n  service a(server)[A] in inner")).rejects.toThrow(/unknown parent/);
  });
});
