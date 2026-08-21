import { describe, expect, it } from "vitest";
import { estimateTextWidth, measureLabel, wrapText } from "./measure-text.js";

describe("estimateTextWidth", () => {
  it("scales with the font size", () => {
    expect(estimateTextWidth("Hello", 26)).toBeCloseTo(estimateTextWidth("Hello", 13) * 2);
  });

  it("gives an empty string no width", () => {
    expect(estimateTextWidth("", 13)).toBe(0);
  });

  // The buckets exist to get the ordering right, which is all a box size needs: `mmm` must come out
  // wider than `iii` by a lot, and `MMM` wider than `mmm` is not required.
  it("orders narrow, normal and wide glyphs correctly", () => {
    expect(estimateTextWidth("iii", 13)).toBeLessThan(estimateTextWidth("nnn", 13));
    expect(estimateTextWidth("nnn", 13)).toBeLessThan(estimateTextWidth("mmm", 13));
  });

  it("is within a reasonable margin of a real sans-serif", () => {
    // "PostgreSQL" at 13px in Inter measures about 74px in a browser. A few percent either way is
    // invisible in a box that carries 14px of padding on each side.
    expect(estimateTextWidth("PostgreSQL", 13)).toBeGreaterThan(60);
    expect(estimateTextWidth("PostgreSQL", 13)).toBeLessThan(95);
  });
});

describe("wrapText", () => {
  it("keeps a short label on one line", () => {
    expect(wrapText("REST API", 13, 400)).toEqual(["REST API"]);
  });

  it("wraps at the last word that fits", () => {
    const lines = wrapText("one two three four five six", 13, 60);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe("one two three four five six");
  });

  // Hyphenating `PostgreSQL` into `Postgre-SQL` is worse than a box that sticks out, so a word wider
  // than the whole line is left alone rather than broken.
  it("leaves an over-long word unbroken", () => {
    expect(wrapText("Supercalifragilistic", 13, 10)).toEqual(["Supercalifragilistic"]);
  });

  it("collapses runs of whitespace", () => {
    expect(wrapText("  a   b  ", 13, 400)).toEqual(["a b"]);
  });

  it("gives an empty string no lines", () => {
    expect(wrapText("   ", 13, 400)).toEqual([]);
  });
});

describe("measureLabel", () => {
  it("reports the widest line, not the sum", () => {
    const label = measureLabel("aaaa bbbb", { fontSize: 13, lineHeight: 1.35, maxWidth: 40 });
    expect(label.lines).toHaveLength(2);
    expect(label.width).toBeLessThan(estimateTextWidth("aaaa bbbb", 13));
  });

  it("reports height as lines times leading", () => {
    const label = measureLabel("aaaa bbbb", { fontSize: 10, lineHeight: 2, maxWidth: 40 });
    expect(label.height).toBe(label.lines.length * 20);
  });

  it("uses a supplied measurer instead of the estimate", () => {
    const label = measureLabel("abc", { fontSize: 13, lineHeight: 1, maxWidth: 999, measure: () => 42 });
    expect(label.width).toBe(42);
  });
});
