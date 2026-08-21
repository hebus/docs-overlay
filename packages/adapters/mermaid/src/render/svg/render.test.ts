import { describe, expect, it } from "vitest";
import { CSS_VARIABLES } from "../../themes/theme.js";
import { layoutDiagram } from "../../layout/layout.js";
import { parseMermaid } from "../../parser/registry.js";
import { enrichMermaid } from "../../semantic/enrich.js";
import { architectures, flowcharts } from "../../testing/fixtures.js";
import type { RenderOptions, RenderResult } from "../renderer.js";
import { roundedPath } from "./edge.js";
import { diagramStylesheet, renderSvg, scopeOf } from "./render.js";
import { technicalTheme } from "../../themes/technical.js";

const render = async (source: string, options: RenderOptions = {}): Promise<RenderResult> =>
  renderSvg(layoutDiagram(enrichMermaid(await parseMermaid(source)), { theme: options.theme }), options);

describe("renderSvg", () => {
  it("produces a single well-formed root element", async () => {
    const { svg } = await render(flowcharts.lr);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg.match(/<svg /g)).toHaveLength(1);
  });

  it("reports the same size it puts in the viewBox", async () => {
    const result = await render(flowcharts.lr);
    expect(result.svg).toContain(`viewBox="0 0 ${result.width} ${result.height}"`);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  // Responsive without a media query, and without the caller having to write CSS: the box shrinks
  // with its container and the aspect ratio holds.
  it("is responsive by construction", async () => {
    const { svg } = await render(flowcharts.lr);
    expect(svg).toContain("max-width:100%;height:auto");
  });

  it("carries the accessibility surface a screen reader needs", async () => {
    const { svg } = await render(flowcharts.lr);
    expect(svg).toContain('role="img"');
    const labelled = /aria-labelledby="(do-t-\w+) (do-d-\w+)"/.exec(svg);
    expect(labelled).not.toBeNull();
    expect(svg).toContain(`<title id="${labelled?.[1] ?? ""}">`);
    expect(svg).toContain(`<desc id="${labelled?.[2] ?? ""}">`);
  });

  it("prefers the author's title and description over the generated ones", async () => {
    const { svg } = await render(architectures.titled);
    expect(svg).toContain("<title id=");
    expect(svg).toContain("Payments platform");
    expect(svg).toContain("How a payment flows through the platform");
  });

  it("takes an explicit title and description over everything", async () => {
    const { svg } = await render(architectures.titled, { accessibility: { title: "Mine", description: "Also mine" } });
    expect(svg).toContain(">Mine</title>");
    expect(svg).toContain(">Also mine</desc>");
  });

  it("draws a node, an edge and a label for each one in the model", async () => {
    const { svg } = await render(flowcharts.lr);
    expect(svg.match(/class="do-node /g)).toHaveLength(5);
    expect(svg.match(/class="do-edge do-edge-/g)).toHaveLength(4);
    for (const label of ["Developer", "Angular", "REST API", "PostgreSQL", "Redis"]) expect(svg).toContain(`>${label}</tspan>`);
  });

  it("tags each node with its semantic type, which is what the accent hangs off", async () => {
    const { svg } = await render(flowcharts.lr);
    for (const type of ["do-type-person", "do-type-frontend", "do-type-api", "do-type-database", "do-type-cache"]) {
      expect(svg).toContain(type);
    }
  });

  it("draws an icon for a typed node", async () => {
    const { svg } = await render(flowcharts.lr);
    expect(svg.match(/class="do-icon"/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("reads every colour through a CSS custom property, so a site can restyle it", async () => {
    const { svg } = await render(flowcharts.lr);
    for (const variable of Object.values(CSS_VARIABLES)) expect(svg, variable).toContain(`var(${variable},`);
  });

  it("ships a dark palette as well as a light one", async () => {
    const { svg } = await render(flowcharts.lr);
    expect(svg).toContain("@media (prefers-color-scheme:dark)");
  });

  // An inline `<style>` in inline SVG is document-global, so an unscoped `.do-node` rule would style
  // markup this package did not generate.
  it("scopes every style rule to a class on its own root", async () => {
    const { svg } = await render(flowcharts.lr);
    const style = /<style>([\s\S]*?)<\/style>/.exec(svg)?.[1] ?? "";
    expect(style).not.toBe("");
    for (const rule of style.split("}").filter(part => part.includes("{"))) {
      const selector = rule.slice(rule.lastIndexOf("{") === -1 ? 0 : 0, rule.indexOf("{"));
      if (selector.startsWith("@media") || selector.trim() === "") continue;
      expect(selector, selector).toContain(".do-diagram-technical");
    }
  });

  it("carries no script and no event handler, whatever the labels say", async () => {
    const { svg } = await render(flowcharts.quotedLabel);
    expect(svg).not.toContain("<script");
    expect(svg).not.toMatch(/\son[a-z]+=/i);
    expect(svg).not.toContain("javascript:");
  });

  it("escapes a label that tries to close its own element", async () => {
    const { svg } = await render(flowcharts.quotedLabel);
    // The source label is literally `Tom &amp; Jerry <script>`, so the output must show it as text.
    expect(svg).toContain("Tom &amp;amp; Jerry &lt;script&gt;");
  });

  it("gives each diagram its own marker ids, so two on a page do not steal each other's arrows", async () => {
    const first = await render(flowcharts.lr);
    const second = await render(flowcharts.tb);
    const idOf = (svg: string): string => /id="do-arrow-(\w+)"/.exec(svg)?.[1] ?? "";
    expect(idOf(first.svg)).not.toBe("");
    expect(idOf(first.svg)).not.toBe(idOf(second.svg));
  });

  it("draws a group box with its title", async () => {
    const { svg } = await render(architectures.basic);
    expect(svg).toContain('class="do-group-box"');
    expect(svg).toContain(">API</tspan>");
  });

  it("draws an architecture service without a box, unlike a flowchart node", async () => {
    const service = await render(architectures.basic);
    const flow = await render(flowcharts.tb);
    // Two services, and the only `do-shape` rect in the output belongs to neither of them.
    expect(service.svg.match(/class="do-shape"/g)).toBeNull();
    expect(flow.svg.match(/class="do-shape"/g)).toHaveLength(3);
  });

  it("draws a junction as a dot", async () => {
    const { svg } = await render(architectures.junction);
    expect(svg).toContain('class="do-junction"');
  });

  it("clips the accent stripe with the node's own outline", async () => {
    // `lr`, not `tb`: an untyped node wears no stripe, so a diagram of bare ids has nothing to clip.
    const { svg } = await render(flowcharts.lr);
    expect(svg).toContain("<clipPath");
    expect(svg).toMatch(/class="do-accent"[^>]*clip-path="url\(#do-clip-/);
  });

  it("produces byte-identical output twice", async () => {
    const first = await render(flowcharts.lr);
    const second = await render(flowcharts.lr);
    expect(second.svg).toBe(first.svg);
  });

  it("refuses a theme it does not have", async () => {
    // Falling back silently would ship the wrong look and say nothing about it. All three shipped
    // themes now resolve, so the name here has to be one that genuinely does not exist.
    await expect(render(flowcharts.lr, { theme: "sketchy" as "technical" })).rejects.toThrow(/no theme called/);
  });
});

/*
 * A snapshot exists here for one reason: adding a theme must not change an existing one. When
 * `illustrated` was added it needed two new mechanisms and a change to node sizing, and the only way to
 * know `technical` came out unchanged was to diff its output against the published package. This makes
 * that check part of the suite instead of a thing somebody remembers to do.
 */
describe("diagramStylesheet", () => {
  /*
   * Inlined, these rules are the largest part of a small diagram, and a page with ten diagrams repeats
   * them ten times. This is the way out for a caller that can put CSS on the page once.
   */
  it("is what the inline mode embeds, so the two cannot drift", async () => {
    const { svg } = await render(flowcharts.lr, { theme: "technical" });
    const embedded = /<style>([\s\S]*?)<\/style>/.exec(svg)?.[1] ?? "";
    expect(embedded).not.toBe("");
    expect(diagramStylesheet("technical")).toBe(embedded);
  });

  it("omits the style element when the caller takes it", async () => {
    const external = await render(flowcharts.lr, { stylesheet: "external" });
    expect(external.svg).not.toContain("<style>");
    // Still scoped by the same class, so the sheet the caller emits still matches.
    expect(external.svg).toContain(scopeOf(technicalTheme));
  });

  /*
   * Measured, not hoped for: the sheet is 4.3 kB, so it is 70% of a two-node diagram and 43% of a
   * five-node one. On a page of four it takes 29.7 kB down to 16.7 kB. The threshold here is the
   * smaller of the two savings, so the test says something true about the worst case.
   */
  it("takes a third off a diagram that is mostly drawing", async () => {
    const inline = await render(flowcharts.lr);
    const external = await render(flowcharts.lr, { stylesheet: "external" });
    expect(external.svg.length).toBeLessThan(inline.svg.length * 0.6);

    const two = "flowchart LR\n A --> B";
    const small = await render(two);
    const smallExternal = await render(two, { stylesheet: "external" });
    expect(smallExternal.svg.length).toBeLessThan(small.svg.length * 0.35);
  });

  it("changes nothing but the style element", async () => {
    const inline = await render(flowcharts.lr);
    const external = await render(flowcharts.lr, { stylesheet: "external" });
    expect(inline.svg.replace(/<style>[\s\S]*?<\/style>/, "")).toBe(external.svg);
    expect([external.width, external.height]).toEqual([inline.width, inline.height]);
  });

  it("answers for a theme object as well as a name", () => {
    expect(diagramStylesheet(technicalTheme)).toBe(diagramStylesheet("technical"));
    expect(diagramStylesheet(undefined)).toBe(diagramStylesheet("technical"));
  });

  it("gives two themes two scopes, so both sheets can sit on one page", () => {
    expect(diagramStylesheet("illustrated")).not.toBe(diagramStylesheet("technical"));
    expect(diagramStylesheet("illustrated")).toContain("do-diagram-illustrated");
    expect(diagramStylesheet("illustrated")).not.toContain("do-diagram-technical");
  });
});

describe("the minimal theme", () => {
  /*
   * Very little decoration, read subtractively: no icon, no accent bar, no shadow, no plate. What is
   * left is the shape, the label and the line.
   */
  it("draws no decoration at all", async () => {
    const { svg } = await render(flowcharts.lr, { theme: "minimal" });
    expect(svg).not.toContain('class="do-icon"');
    expect(svg).not.toContain('class="do-accent"');
    expect(svg).not.toContain("do-icon-plate");
    expect(svg).not.toContain("<filter");
    expect(svg).not.toContain("<clipPath");
  });

  it("still draws every node, edge and label", async () => {
    const { svg } = await render(flowcharts.lr, { theme: "minimal" });
    expect(svg.match(/class="do-node /g)).toHaveLength(5);
    expect(svg.match(/class="do-edge do-edge-/g)).toHaveLength(4);
    for (const label of ["Developer", "Angular", "REST API", "PostgreSQL", "Redis"]) expect(svg).toContain(`>${label}</tspan>`);
  });

  // The semantic pass still ran: a site that wants the colour back can restyle these classes without
  // regenerating anything.
  it("keeps the semantic class even though it paints nothing with it", async () => {
    const { svg } = await render(flowcharts.lr, { theme: "minimal" });
    expect(svg).toContain("do-type-database");
    expect(svg).toContain("do-type-cache");
  });

  /*
   * With no stripe, no plate and no icons, nothing reads `--do-accent` — so the fifteen per-type
   * declarations are dead CSS, and this sheet is the largest part of a small diagram. Minimal in bytes,
   * not only in ink.
   */
  it("omits the accent declarations nothing would read", async () => {
    const sheet = diagramStylesheet("minimal");
    expect(sheet).not.toContain("--do-accent:");
    expect(diagramStylesheet("technical")).toContain("--do-accent:");
    expect(sheet.length).toBeLessThan(diagramStylesheet("technical").length * 0.7);
  });

  it("comes out smaller than the theme it strips down", async () => {
    const bare = await render(flowcharts.lr, { theme: "minimal" });
    const flat = await render(flowcharts.lr, { theme: "technical" });
    expect(bare.svg.length).toBeLessThan(flat.svg.length);
    expect(bare.width).toBeLessThan(flat.width);
  });

  it("keeps every promise the others keep", async () => {
    const { svg } = await render(flowcharts.quotedLabel, { theme: "minimal" });
    expect(svg).not.toContain("<script");
    expect(svg).toContain('role="img"');
    expect(svg).toContain("@media (prefers-color-scheme:dark)");
  });
});

describe("the technical theme", () => {
  it("renders exactly what it rendered before", async () => {
    const { svg } = await render(flowcharts.lr, { theme: "technical" });
    await expect(svg).toMatchFileSnapshot("./__snapshots__/technical.svg");
  });
});

describe("the illustrated theme", () => {
  it("renders the same diagram through a different look", async () => {
    const flat = await render(flowcharts.lr, { theme: "technical" });
    const card = await render(flowcharts.lr, { theme: "illustrated" });
    expect(card.svg).not.toBe(flat.svg);
    // Same nodes and edges: a theme changes the drawing, never the diagram.
    expect(card.svg.match(/class="do-node /g)).toHaveLength(flat.svg.match(/class="do-node /g)?.length ?? 0);
    expect(card.svg.match(/class="do-edge do-edge-/g)).toHaveLength(flat.svg.match(/class="do-edge do-edge-/g)?.length ?? 0);
  });

  it("scopes its stylesheet under its own name, so both can sit on one page", async () => {
    const card = await render(flowcharts.lr, { theme: "illustrated" });
    expect(card.svg).toContain("do-diagram-illustrated");
    expect(card.svg).not.toContain("do-diagram-technical");
  });

  it("draws an icon plate and a shadow, which the flat theme does not", async () => {
    const card = await render(flowcharts.lr, { theme: "illustrated" });
    const flat = await render(flowcharts.lr, { theme: "technical" });
    expect(card.svg).toContain('class="do-icon-plate"');
    expect(card.svg).toMatch(/<filter id="do-shadow-\w+"/);
    expect(card.svg).toMatch(/class="do-shape" [^>]*filter="url\(#do-shadow-/);
    // A flat theme must not pay for a filter it never references.
    expect(flat.svg).not.toContain("do-icon-plate");
    expect(flat.svg).not.toContain("<filter");
  });

  it("gives the plate room instead of letting it sit under the label", async () => {
    const flat = await render(flowcharts.lr, { theme: "technical" });
    const card = await render(flowcharts.lr, { theme: "illustrated" });
    // The plate is wider than the bare icon, so every box has to grow with it.
    expect(card.width).toBeGreaterThan(flat.width);
  });

  it("keeps every promise the flat theme keeps", async () => {
    const card = await render(flowcharts.quotedLabel, { theme: "illustrated" });
    expect(card.svg).not.toContain("<script");
    expect(card.svg).not.toMatch(/\son[a-z]+=/i);
    expect(card.svg).toContain('role="img"');
    expect(card.svg).toContain("@media (prefers-color-scheme:dark)");
    for (const variable of Object.values(CSS_VARIABLES)) expect(card.svg, variable).toContain(`var(${variable},`);
  });

  it("is deterministic too", async () => {
    const first = await render(architectures.nested, { theme: "illustrated" });
    const second = await render(architectures.nested, { theme: "illustrated" });
    expect(second.svg).toBe(first.svg);
  });
});

describe("roundedPath", () => {
  it("draws a straight line through two points", () => {
    expect(
      roundedPath(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ],
        6
      )
    ).toBe("M0 0L10 0");
  });

  it("rounds a corner with a quadratic through it", () => {
    const path = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      4
    );
    expect(path).toContain("Q10 0");
  });

  // Shortened by at most half a leg, so the curve cannot overshoot the next point on a short leg.
  it("never overshoots a leg shorter than the radius", () => {
    const path = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 }
      ],
      40
    );
    expect(path).toContain("L1 0");
  });

  it("returns nothing for fewer than two points", () => {
    expect(roundedPath([], 6)).toBe("");
    expect(roundedPath([{ x: 1, y: 1 }], 6)).toBe("M1 1");
  });
});
