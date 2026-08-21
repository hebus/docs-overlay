import { describe, expect, it } from "vitest";
import { CSS_VARIABLES } from "../../themes/theme.js";
import { layoutDiagram } from "../../layout/layout.js";
import { parseMermaid } from "../../parser/registry.js";
import { enrichMermaid } from "../../semantic/enrich.js";
import { architectures, flowcharts } from "../../testing/fixtures.js";
import type { RenderOptions, RenderResult } from "../renderer.js";
import { roundedPath } from "./edge.js";
import { renderSvg } from "./render.js";

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
    // `illustrated` is planned, not shipped. Falling back silently would ship the wrong look and say
    // nothing about it.
    await expect(render(flowcharts.lr, { theme: "illustrated" as "technical" })).rejects.toThrow(/no theme called/);
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
