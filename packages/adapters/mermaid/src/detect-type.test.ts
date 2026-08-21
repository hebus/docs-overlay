import { describe, expect, it } from "vitest";
import { detectDiagramType, significantLine } from "./detect-type.js";
import { architectures, flowcharts, unsupported } from "./testing/fixtures.js";

describe("significantLine", () => {
  it("skips blank lines and comments to reach the keyword", () => {
    expect(significantLine("\n\n%% a note\n%% another\nflowchart LR")).toEqual({ text: "flowchart LR", line: 5 });
  });

  it("skips frontmatter only when the source opens with it", () => {
    expect(significantLine(flowcharts.frontmatter)?.text).toBe("flowchart LR");
  });

  // `---` is also a legal flowchart link, so a `---` that is not on line 1 must not be treated as a
  // fence: scanning forward for its closer would swallow the diagram.
  it("does not treat a link as a frontmatter fence", () => {
    expect(significantLine("flowchart LR\n A --- B")?.text).toBe("flowchart LR");
  });

  it("returns undefined when there is nothing but comments", () => {
    expect(significantLine("%% one\n\n%% two")).toBeUndefined();
  });
});

describe("detectDiagramType", () => {
  it("reads flowchart from both of its keywords", () => {
    expect(detectDiagramType("flowchart LR\n A --> B")).toBe("flowchart");
    expect(detectDiagramType("graph TD\n A --> B")).toBe("flowchart");
    expect(detectDiagramType("flowchart-elk LR\n A --> B")).toBe("flowchart");
  });

  it("reads architecture from the beta keyword and the bare one", () => {
    expect(detectDiagramType(architectures.basic)).toBe("architecture");
    expect(detectDiagramType("architecture\n service a(server)[A]")).toBe("architecture");
  });

  // Longest-first matching: `stateDiagram-v2` must not be truncated to `stateDiagram`, and both are
  // the same type anyway — the point is that neither is read as something else.
  it("identifies the types it cannot yet render, rather than shrugging", () => {
    expect(detectDiagramType(unsupported.sequence)).toBe("sequence");
    expect(detectDiagramType(unsupported.classDiagram)).toBe("class");
    expect(detectDiagramType("stateDiagram-v2\n [*] --> Idle")).toBe("state");
    expect(detectDiagramType("stateDiagram\n [*] --> Idle")).toBe("state");
    expect(detectDiagramType("erDiagram\n A ||--o{ B : has")).toBe("er");
  });

  it("requires the keyword to end the word", () => {
    expect(detectDiagramType("flowcharting LR")).toBe("unknown");
    expect(detectDiagramType("graphql\n A --> B")).toBe("unknown");
  });

  it("returns unknown for text that is not a diagram", () => {
    expect(detectDiagramType(unsupported.notADiagram)).toBe("unknown");
    expect(detectDiagramType("")).toBe("unknown");
  });

  it("accepts a keyword on its own line, with no direction", () => {
    expect(detectDiagramType("flowchart\n A --> B")).toBe("flowchart");
  });
});
