import { describe, expect, it } from "vitest";
import { MermaidError } from "../errors.js";
import { defaultIcons } from "./default-icons.js";
import { assertSafeIcon, createIconRegistry, defaultIconRegistry, extendIconRegistry } from "./registry.js";

const icon = (content: string): { id: string; viewBox: string; content: string } => ({ id: "probe", viewBox: "0 0 24 24", content });

describe("defaultIcons", () => {
  // A diagram written against Mermaid's `architecture-beta` names its icons from this set, so dropping
  // one of them would silently render a service with no icon at all.
  it("covers the names Mermaid's architecture-beta ships", () => {
    const names = defaultIcons.map(definition => definition.id);
    for (const required of ["database", "server", "disk", "internet", "cloud", "unknown", "blank"]) {
      expect(names, required).toContain(required);
    }
  });

  it("covers one icon per semantic type that claims one", () => {
    const names = defaultIcons.map(definition => definition.id);
    for (const required of ["user", "api", "queue", "cache", "storage", "frontend", "backend", "service", "component", "file", "application"]) {
      expect(names, required).toContain(required);
    }
  });

  it("carries geometry only, so the renderer owns stroke and colour", () => {
    for (const definition of defaultIcons) {
      expect(definition.content, definition.id).not.toMatch(/\b(?:fill|stroke|style)=/);
    }
  });

  it("passes its own safety check", () => {
    for (const definition of defaultIcons) expect(() => assertSafeIcon(definition)).not.toThrow();
  });
});

describe("assertSafeIcon", () => {
  /*
   * Icon content is the one thing inlined into the SVG unescaped — escaping it would turn the drawing
   * into visible text — so this is the boundary that has to hold. It is checked on registration rather
   * than on render, so a bad icon fails once, where somebody can fix it.
   */
  it("refuses script, handlers and javascript URLs", () => {
    expect(() => assertSafeIcon(icon("<script>alert(1)</script>"))).toThrow(MermaidError);
    expect(() => assertSafeIcon(icon('<path onclick="x()"/>'))).toThrow(/event handler/);
    expect(() => assertSafeIcon(icon('<a href="javascript:x()"/>'))).toThrow(/javascript/);
    expect(() => assertSafeIcon(icon("<foreignObject><b>hi</b></foreignObject>"))).toThrow(/foreignObject/);
  });

  // Both take a URL, and a URL is a network request at render time — the one thing this package
  // promises never to make.
  it("refuses the elements that would fetch something", () => {
    expect(() => assertSafeIcon(icon('<use href="https://example.com/i.svg#x"/>'))).toThrow(/fetch a URL/);
    expect(() => assertSafeIcon(icon('<image href="https://example.com/i.png"/>'))).toThrow(/fetch a URL/);
  });

  it("accepts plain geometry", () => {
    expect(() => assertSafeIcon(icon('<path d="M0 0h24v24H0z"/>'))).not.toThrow();
  });
});

describe("createIconRegistry", () => {
  it("finds an icon by name and reports a miss as undefined", () => {
    expect(defaultIconRegistry.get("database")?.id).toBe("database");
    expect(defaultIconRegistry.get("nope")).toBeUndefined();
  });

  it("refuses to build a registry around an unsafe icon", () => {
    expect(() => createIconRegistry([icon("<script/>")])).toThrow(MermaidError);
  });

  it("replaces the default set entirely when given one", () => {
    expect(createIconRegistry([icon('<path d="M0 0"/>')]).get("database")).toBeUndefined();
  });
});

describe("extendIconRegistry", () => {
  // The common case is adding a `credit-card` for a payments service, not replacing `database`.
  it("keeps the built-in set and adds to it", () => {
    const registry = extendIconRegistry([{ id: "credit-card", viewBox: "0 0 24 24", content: '<rect x="2" y="6" width="20" height="12" rx="2"/>' }]);
    expect(registry.get("credit-card")).toBeDefined();
    expect(registry.get("database")).toBeDefined();
  });

  it("lets a later icon of the same name win", () => {
    const registry = extendIconRegistry([{ id: "database", viewBox: "0 0 24 24", content: '<circle cx="12" cy="12" r="5"/>' }]);
    expect(registry.get("database")?.content).toContain("circle");
  });
});
