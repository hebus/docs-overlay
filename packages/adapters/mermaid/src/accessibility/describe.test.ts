import { describe as group, expect, it } from "vitest";
import { layoutDiagram } from "../layout/layout.js";
import type { LayoutResult } from "../model/layout.js";
import { parseMermaid } from "../parser/registry.js";
import { enrichMermaid } from "../semantic/enrich.js";
import { architectures, flowcharts } from "../testing/fixtures.js";
import { describe, hash } from "./describe.js";

const lay = async (source: string): Promise<LayoutResult> => layoutDiagram(enrichMermaid(await parseMermaid(source)));

group("describe", () => {
  it("takes the caller's title and description over everything", async () => {
    const described = describe(await lay(architectures.titled), { title: "T", description: "D" });
    expect(described).toMatchObject({ title: "T", description: "D" });
  });

  it("takes the source's title and accDescr next", async () => {
    const described = describe(await lay(architectures.titled));
    expect(described.title).toBe("Payments platform");
    expect(described.description).toBe("How a payment flows through the platform");
  });

  /*
   * A diagram with no `<desc>` is announced as "image", which tells a reader nothing about a drawing
   * whose entire content is the relationships between its boxes. So the fallback spells those out.
   */
  it("generates a description from the relationships when the source gives none", async () => {
    const described = describe(await lay(flowcharts.lr));
    expect(described.title).toBe("Flowchart with 5 nodes");
    expect(described.description).toBe("Developer to Angular; Angular to REST API; REST API to PostgreSQL; REST API to Redis.");
  });

  it("names the nodes when nothing is connected", async () => {
    const described = describe(await lay("flowchart LR\n Alpha\n Beta"));
    expect(described.description).toBe("Unconnected: Alpha, Beta.");
  });

  it("summarises the tail rather than reading out a hundred edges", async () => {
    const source = ["flowchart LR", ...Array.from({ length: 20 }, (_, index) => ` n${index} --> n${index + 1}`)].join("\n");
    const described = describe(await lay(source));
    expect(described.description).toContain("and 8 further connections.");
  });

  it("leaves a junction out of the node count, since it is not a thing", async () => {
    const described = describe(await lay(architectures.junction));
    expect(described.title).toBe("Architecture diagram with 2 nodes");
  });

  it("uses the singular for one node", async () => {
    expect(describe(await lay("flowchart LR\n Only")).title).toBe("Flowchart with 1 node");
  });

  /*
   * The id is a hash of the content rather than a counter, and both halves of that matter: a counter
   * would make the second render of the same diagram differ from the first, breaking determinism, and
   * a fixed string would collide between two diagrams on one page — where a duplicated id is silently
   * resolved to whichever appeared first, pointing `aria-labelledby` at the wrong title.
   */
  it("gives the same diagram the same instance id, and a different one a different id", async () => {
    const flow = await lay(flowcharts.lr);
    expect(describe(flow).instance).toBe(describe(flow).instance);
    expect(describe(flow).instance).not.toBe(describe(await lay(flowcharts.tb)).instance);
  });
});

group("hash", () => {
  it("is stable and differs on a one-character change", () => {
    expect(hash("abc")).toBe(hash("abc"));
    expect(hash("abc")).not.toBe(hash("abd"));
  });

  it("produces something usable as an id fragment", () => {
    expect(hash("anything at all")).toMatch(/^[0-9a-z]+$/);
  });
});
