import { describe, expect, it } from "vitest";
import { MermaidError } from "../../errors.js";
import { flowcharts, regressions } from "../../testing/fixtures.js";
import { parseFlowchart } from "./parse.js";

const ids = (source: string): readonly string[] => parseFlowchart(source).nodes.map(node => node.id);
const links = (source: string): readonly string[] => parseFlowchart(source).edges.map(edge => `${edge.source}->${edge.target}`);

describe("parseFlowchart", () => {
  it("reads the header and its direction", () => {
    expect(parseFlowchart(flowcharts.lr).direction).toBe("LR");
    expect(parseFlowchart(flowcharts.tb).direction).toBe("TB");
    expect(parseFlowchart("graph RL\n A --> B").direction).toBe("RL");
    expect(parseFlowchart("graph BT\n A --> B").direction).toBe("BT");
  });

  // `TD` is Mermaid's synonym for `TB`. Keeping both in the model would make every consumer handle a
  // distinction that does not exist.
  it("folds TD into TB", () => {
    expect(parseFlowchart("flowchart TD\n A --> B").direction).toBe("TB");
  });

  it("defaults to TB when the header states no direction", () => {
    expect(parseFlowchart("flowchart\n A --> B").direction).toBe("TB");
  });

  it("declares a node the first time it is seen, in source order", () => {
    expect(ids(flowcharts.lr)).toEqual(["Developer", "App", "API", "DB", "Cache"]);
  });

  it("defaults a label to the id, so an undeclared node is still readable", () => {
    expect(parseFlowchart("flowchart LR\n A --> B").nodes.map(node => node.label)).toEqual(["A", "B"]);
  });

  it("lets a later declaration fill in a label the first mention lacked", () => {
    const diagram = parseFlowchart("flowchart LR\n A --> B\n B[Beta]");
    expect(diagram.nodes.find(node => node.id === "B")?.label).toBe("Beta");
  });

  it("expands a chain into one edge per link", () => {
    expect(links(flowcharts.chain)).toEqual(["A->B", "B->C", "C->D"]);
  });

  // `A & B --> C & D` is a cross product, not two edges: that is what the ampersand means.
  it("expands an ampersand into every pairing", () => {
    expect(links(flowcharts.ampersand)).toEqual(["A->C", "A->D", "B->C", "B->D"]);
  });

  it("nests subgraphs and records membership", () => {
    const diagram = parseFlowchart(flowcharts.subgraphs);
    expect(diagram.groups.map(group => group.id)).toEqual(["edge", "inner", "core"]);
    expect(diagram.groups.find(group => group.id === "inner")?.parent).toBe("edge");
    // Membership order is first-seen order, not declaration order: `CDN` is mentioned before the
    // `inner` subgraph is opened, so it is the first child recorded.
    expect(diagram.groups.find(group => group.id === "edge")?.children).toEqual(["CDN", "inner"]);
    expect(diagram.nodes.find(node => node.id === "WAF")?.group).toBe("inner");
    expect(diagram.nodes.find(node => node.id === "API")?.group).toBe("core");
  });

  it("reads a subgraph title from brackets and from a bare name", () => {
    expect(parseFlowchart("flowchart TB\n subgraph one [First]\n A\n end").groups.at(0)).toMatchObject({ id: "one", label: "First" });
    expect(parseFlowchart("flowchart TB\n subgraph Solo\n A\n end").groups.at(0)).toMatchObject({ id: "Solo", label: "Solo" });
  });

  it("carries class names from both syntaxes, opaquely", () => {
    const diagram = parseFlowchart(flowcharts.classes);
    expect(diagram.nodes.find(node => node.id === "A")?.classNames).toEqual(["hot"]);
    expect(diagram.nodes.find(node => node.id === "B")?.classNames).toEqual(["hot"]);
  });

  // These are all valid Mermaid and all meaningless without a browser to click in or a stylesheet to
  // override. Reading and dropping them is what keeps a real-world diagram from failing to parse.
  it("accepts and ignores the statements that need a browser", () => {
    const diagram = parseFlowchart(flowcharts.ignored);
    expect(diagram.nodes.map(node => node.id)).toEqual(["A", "B"]);
    expect(diagram.edges).toHaveLength(1);
  });

  it("accepts frontmatter above the header", () => {
    expect(links(flowcharts.frontmatter)).toEqual(["A->B"]);
  });

  it("accepts semicolons instead of newlines", () => {
    expect(links(flowcharts.semicolons)).toEqual(["A->B", "B->C"]);
  });

  it("keeps a quoted label exactly as written", () => {
    const diagram = parseFlowchart(flowcharts.quotedLabel);
    expect(diagram.nodes.at(0)?.label).toBe("Tom &amp; Jerry <script>");
    expect(diagram.nodes.at(1)?.label).toBe("100%% done");
  });

  it("refuses a source with no header", () => {
    expect(() => parseFlowchart("A --> B")).toThrow(MermaidError);
    expect(() => parseFlowchart("A --> B")).toThrow(/Expected `flowchart` or `graph`/);
  });

  it("refuses an `end` that closes nothing", () => {
    expect(() => parseFlowchart("flowchart TB\n end")).toThrow(/closes nothing/);
  });

  it("refuses a truncated diagram by default", () => {
    expect(() => parseFlowchart(flowcharts.truncated)).toThrow(MermaidError);
  });

  /*
   * A Markdown stream delivers a diagram a few lines at a time, so every intermediate state is a
   * syntax error. `tolerant` is what makes those harmless: the finished lines render and the
   * half-typed one is dropped, instead of the whole page failing on a diagram that is still arriving.
   */
  it("renders what it can when tolerant", () => {
    const diagram = parseFlowchart(flowcharts.truncated, { tolerant: true });
    expect(links(flowcharts.truncated.replace("\n    B -->", ""))).toEqual(["A->B"]);
    expect(diagram.edges).toHaveLength(1);
    expect(diagram.nodes.map(node => node.id)).toEqual(["A", "B"]);
  });

  it("reads the shapes onto the model", () => {
    const shapes = parseFlowchart(flowcharts.shapes).nodes.map(node => node.shape);
    expect(shapes).toEqual(["rectangle", "rounded", "stadium", "subroutine", "cylinder", "circle", "rhombus", "hexagon"]);
  });

  it("reads edge kinds and labels onto the model", () => {
    const diagram = parseFlowchart(flowcharts.edgeLabels);
    expect(diagram.edges.map(edge => edge.label)).toEqual(["yes", "maybe", "later", "heavy"]);
    expect(diagram.edges.map(edge => edge.type)).toEqual(["solid", "solid", "dotted", "thick"]);
  });

  it("keeps the chain and the labeled link apart in one source", () => {
    const diagram = parseFlowchart(flowcharts.chainVersusLabel);
    expect(diagram.nodes.map(node => node.id)).toEqual(["A", "B", "C", "X", "Y"]);
    expect(diagram.edges.find(edge => edge.source === "X")?.label).toBe("carries");
  });

  /*
   * Hyphenated ids are the most common thing a real diagram would have hit, and they used to raise. The
   * rule is narrow on purpose: a hyphen continues an id only when a word character follows it, so a link
   * written without spaces is still a link.
   */
  it("reads a hyphen inside a node id", () => {
    const diagram = parseFlowchart(regressions.hyphenatedIds);
    expect(diagram.nodes.map(node => node.id)).toEqual(["user-service", "api-gateway", "user-db"]);
    expect(links(regressions.hyphenatedIds)).toEqual(["user-service->api-gateway", "api-gateway->user-db"]);
  });

  it("still reads a link that has no spaces around it", () => {
    const diagram = parseFlowchart(regressions.hyphenAgainstLinks);
    expect(diagram.nodes.map(node => node.id)).toEqual(["a-b", "c-d", "x", "y", "p", "q"]);
    // The dotted one is the trap: `.` is an id character, so `x-.->y` would become an id `x-.`
    // if the lookahead after a hyphen were the id set rather than just word characters.
    expect(diagram.edges.map(edge => edge.type)).toEqual(["solid", "dotted", "thick"]);
  });

  /*
   * This used to produce three nodes — `A`, a phantom `b`, and `B` — which is the failure this package
   * says it will not commit: a drawing that lies rather than an error. Quoting now works, which is
   * Mermaid's own convention for a label with special characters in it.
   */
  it("keeps a quoted inline label whole when it contains a link", () => {
    const diagram = parseFlowchart(regressions.dashesInQuotedLabel);
    expect(diagram.nodes.map(node => node.id)).toEqual(["A", "B"]);
    expect(diagram.edges.at(0)?.label).toBe("a--b");
  });

  it("reports architecture-specific fields as absent rather than guessing them", () => {
    const diagram = parseFlowchart(flowcharts.lr);
    expect(diagram.alignments).toEqual([]);
    expect(diagram.edges.every(edge => edge.sourceSide === undefined)).toBe(true);
  });
});
