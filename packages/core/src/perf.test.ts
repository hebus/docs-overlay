import { describe, expect, it } from "vitest";

import { createOverlay } from "./create-overlay.js";
import { page, type Meta } from "./testing/fixtures.js";
import type { ContentEntry } from "./source/content-source.js";

/**
 * A guard against an accidentally quadratic fold, not a benchmark. The fold copies its parent's
 * index, so the total work is O(versions x pages); anything that walked the chain per lookup would
 * blow through this budget immediately.
 */
describe("fold cost", () => {
  it("indexes 10 versions of 500 pages well under 100 ms", () => {
    const entries: ContentEntry<Meta>[] = [];
    for (let index = 0; index < 500; index += 1) entries.push(page(`1.0.0/section-${index % 20}/page-${index}.md`));
    // Nine more versions, each overriding a tenth of the tree.
    for (let version = 2; version <= 10; version += 1) {
      for (let index = 0; index < 50; index += 1) entries.push(page(`${version}.0.0/section-${index % 20}/page-${index}.md`));
    }

    const started = Date.now();
    const overlay = createOverlay<Meta>({ source: entries });
    overlay.diagnostics(); // forces every version to be folded
    const elapsed = Date.now() - started;

    expect(overlay.versions).toHaveLength(10);
    expect(overlay.getPages("10.0.0")).toHaveLength(500);
    expect(elapsed).toBeLessThan(100);
  });

  it("answers a resolved lookup without re-walking the chain", () => {
    const entries: ContentEntry<Meta>[] = [];
    for (let version = 1; version <= 10; version += 1) entries.push(page(`${version}.0.0/page-${version}.md`));
    const overlay = createOverlay<Meta>({ source: entries });

    overlay.resolve("10.0.0", "page-1");
    const foldsAfterFirst = overlay.foldCount;

    for (let index = 0; index < 10_000; index += 1) overlay.resolve("10.0.0", "page-1");
    expect(overlay.foldCount).toBe(foldsAfterFirst);
  });
});
