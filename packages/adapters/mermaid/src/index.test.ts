import { describe, expect, it, vi } from "vitest";
import { MermaidError } from "./errors.js";
import type { DiagramCache, RenderResult } from "./render/renderer.js";
import { cacheKey, renderMermaid, RENDERER_VERSION } from "./index.js";
import { architectures, flowcharts, unsupported } from "./testing/fixtures.js";
import { technicalTheme } from "./themes/technical.js";

const memoryCache = (): DiagramCache & { readonly entries: Map<string, RenderResult> } => {
  const entries = new Map<string, RenderResult>();
  return { entries, get: key => entries.get(key), set: (key, result) => void entries.set(key, result) };
};

describe("renderMermaid", () => {
  /*
   * The success criterion for the whole package: this source, no options beyond a theme, and an SVG
   * out — in Node, with no DOM, no network and nothing to configure.
   */
  it("renders the flowchart the package exists for", async () => {
    const result = await renderMermaid(flowcharts.lr, { theme: "technical" });
    expect(result.svg).toContain("<svg");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.svg).toContain("do-type-database");
    expect(result.svg).toContain("do-type-cache");
  });

  it("renders an architecture diagram through the other parser", async () => {
    const result = await renderMermaid(architectures.basic);
    expect(result.svg).toContain('class="do-group-box"');
    expect(result.svg).toContain(">Server</tspan>");
  });

  it("applies a user rule end to end", async () => {
    const result = await renderMermaid("flowchart LR\n payments[Payments] --> DB[PostgreSQL]", {
      semantic: { rules: [{ match: node => node.id === "payments", type: "service", icon: "service" }] }
    });
    expect(result.svg).toContain("do-type-service");
  });

  it("tells a diagram it cannot render from text that is not a diagram", async () => {
    await expect(renderMermaid(unsupported.sequence)).rejects.toThrow(/not supported yet/);
    await expect(renderMermaid(unsupported.notADiagram)).rejects.toThrow(/No Mermaid diagram keyword/);
  });

  it("reports an error with a code a caller can switch on", async () => {
    const error = await renderMermaid(unsupported.sequence).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(MermaidError);
    expect((error as MermaidError).code).toBe("unsupported-diagram-type");
    expect((error as MermaidError).diagramType).toBe("sequence");
  });

  /*
   * A fallback is the caller saying "show something rather than fail" — and it is how Mermaid stays
   * out of this package's dependencies while a consumer still has something to render for a diagram
   * type there is no parser for.
   */
  it("hands an unsupported diagram to a fallback instead of throwing", async () => {
    const fallback = { render: vi.fn(() => ({ svg: "<svg data-fallback/>", width: 1, height: 1 })) };
    const result = await renderMermaid(unsupported.sequence, { fallback });
    expect(result.svg).toBe("<svg data-fallback/>");
    expect(fallback.render).toHaveBeenCalledWith(unsupported.sequence);
  });

  it("hands a syntax error to a fallback too", async () => {
    const fallback = { render: () => ({ svg: "<svg data-fallback/>", width: 1, height: 1 }) };
    await expect(renderMermaid(flowcharts.truncated)).rejects.toThrow(MermaidError);
    expect((await renderMermaid(flowcharts.truncated, { fallback })).svg).toBe("<svg data-fallback/>");
  });

  it("renders as far as it can when tolerant, without a fallback", async () => {
    const result = await renderMermaid(flowcharts.truncated, { tolerant: true });
    expect(result.svg).toContain(">A</tspan>");
    expect(result.svg).toContain(">B</tspan>");
  });

  it("serves a cached result and does not re-render", async () => {
    const cache = memoryCache();
    const first = await renderMermaid(flowcharts.lr, { cache });
    expect(cache.entries.size).toBe(1);

    cache.entries.set(cacheKey(flowcharts.lr, { cache }), { svg: "<svg data-stale/>", width: 1, height: 1 });
    const second = await renderMermaid(flowcharts.lr, { cache });
    expect(second.svg).toBe("<svg data-stale/>");
    expect(second.svg).not.toBe(first.svg);
  });

  it("is deterministic across calls", async () => {
    const first = await renderMermaid(flowcharts.lr);
    const second = await renderMermaid(flowcharts.lr);
    expect(second.svg).toBe(first.svg);
  });
});

describe("cacheKey", () => {
  // Naming the default theme explicitly must produce the *same* key as omitting it — otherwise a
  // caller who spells out the default gets a second copy of every diagram in their cache.
  it("treats the named default and no theme as the same", () => {
    expect(cacheKey("x", { theme: "technical" })).toBe(cacheKey("x", {}));
  });

  it("separates two themes on the same source", () => {
    expect(cacheKey("x", { theme: { ...technicalTheme, name: "custom" } })).not.toBe(cacheKey("x", {}));
  });

  /*
   * Rules are closures, so their *source* is what gets hashed. Unusual, but it is the only property of
   * a function that is both stable across runs and sensitive to an edit — and a key that ignored the
   * rules would keep serving the diagram from before a rule was added.
   */
  it("separates two sets of rules, and notices one being edited", () => {
    const withRule = cacheKey("x", { semantic: { rules: [{ match: node => node.id === "a", type: "service" }] } });
    const withOther = cacheKey("x", { semantic: { rules: [{ match: node => node.id === "b", type: "service" }] } });
    expect(withRule).not.toBe(cacheKey("x", {}));
    expect(withRule).not.toBe(withOther);
  });

  it("separates defaults on from defaults off", () => {
    expect(cacheKey("x", { semantic: { disableDefaults: true } })).not.toBe(cacheKey("x", { semantic: { disableDefaults: false } }));
  });

  // A consumer holding a warm cache across an upgrade must get the new output, not last version's.
  it("carries the renderer version", () => {
    expect(cacheKey("x")).toContain(String(RENDERER_VERSION));
  });

  it("separates two sources", () => {
    expect(cacheKey("a")).not.toBe(cacheKey("b"));
  });
});
