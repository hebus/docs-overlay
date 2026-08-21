import { describe, expect, it } from "vitest";
import { attributes, escapeSvgText, round, safeIdentifier } from "./escape.js";

describe("escapeSvgText", () => {
  // `&` first. Reverse the order and `<` becomes `&amp;lt;`, which renders as literal `&lt;`.
  it("escapes the ampersand before anything that produces one", () => {
    expect(escapeSvgText("<")).toBe("&lt;");
    expect(escapeSvgText("&lt;")).toBe("&amp;lt;");
  });

  it("escapes everything that could end an element or an attribute", () => {
    expect(escapeSvgText(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("neutralises a label that tries to inject", () => {
    const escaped = escapeSvgText("</text><script>alert(1)</script>");
    expect(escaped).not.toContain("<script");
    expect(escaped).not.toContain("</text>");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeSvgText("PostgreSQL 16")).toBe("PostgreSQL 16");
  });
});

describe("safeIdentifier", () => {
  // These land in CSS selectors and `aria-labelledby` references, where escaping is not enough:
  // a quote inside an id breaks the selector rather than appearing in it.
  it("drops anything that is not a word character or a dash", () => {
    expect(safeIdentifier('a b"c.d/e')).toBe("a-b-c-d-e");
    expect(safeIdentifier("keep-me_1")).toBe("keep-me_1");
  });
});

describe("attributes", () => {
  it("skips an undefined value, so callers can build conditionally", () => {
    expect(attributes({ a: "1", b: undefined, c: 2 })).toBe('a="1" c="2"');
  });

  it("escapes a string value", () => {
    expect(attributes({ title: 'a "b" c' })).toBe('title="a &quot;b&quot; c"');
  });

  it("rounds a numeric value", () => {
    expect(attributes({ x: 1.23456 })).toBe('x="1.23"');
  });
});

describe("round", () => {
  it("keeps two decimals, which is below what a screen can show", () => {
    expect(round(1.005)).toBe(1);
    expect(round(1.006)).toBe(1.01);
    expect(round(12)).toBe(12);
  });
});
