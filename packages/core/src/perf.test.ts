import { describe, expect, it } from "vitest";

import { createOverlay } from "./create-overlay.js";
import type { ContentEntry } from "./source/content-source.js";
import { page, type Meta } from "./testing/fixtures.js";

/**
 * A guard against an accidentally quadratic fold, not a benchmark.
 *
 * The budget is deliberately loose. It only has to catch an order-of-magnitude regression — walking
 * the chain on every lookup instead of folding once, say — and a tight budget measured with
 * `Date.now()` on a cold CI machine running several workers is flaky, which would make the whole
 * suite untrustworthy for no gain.
 */
const BUDGET_MS = 1_000;

function corpus(versions: number, pagesPerVersion: number): ContentEntry<Meta>[] {
  const entries: ContentEntry<Meta>[] = [];
  for (let index = 0; index < pagesPerVersion; index += 1) entries.push(page(`1.0.0/section-${index % 20}/page-${index}.md`));
  // Each later version overrides a tenth of the tree.
  for (let version = 2; version <= versions; version += 1) {
    for (let index = 0; index < Math.ceil(pagesPerVersion / 10); index += 1) {
      entries.push(page(`${version}.0.0/section-${index % 20}/page-${index}.md`));
    }
  }
  return entries;
}

describe("fold cost", () => {
  it("indexes 10 versions of 500 pages well inside the budget", () => {
    const entries = corpus(10, 500);

    // Warm up so the measurement is not dominated by first-call JIT.
    createOverlay<Meta>({ source: corpus(3, 20) }).diagnostics();

    const started = Date.now();
    const overlay = createOverlay<Meta>({ source: entries });
    overlay.diagnostics(); // forces every version to be folded
    const elapsed = Date.now() - started;

    expect(overlay.versions).toHaveLength(10);
    expect(overlay.getPages("10.0.0")).toHaveLength(500);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("answers a resolved lookup without re-walking the chain", () => {
    const entries: ContentEntry<Meta>[] = [];
    for (let version = 1; version <= 10; version += 1) entries.push(page(`${version}.0.0/page-${version}.md`));
    const overlay = createOverlay<Meta>({ source: entries });

    overlay.resolve("10.0.0", "page-1");
    const foldsAfterFirst = overlay.foldCount;

    // This is the assertion that actually pins the design: ten thousand lookups, zero extra folds.
    for (let index = 0; index < 10_000; index += 1) overlay.resolve("10.0.0", "page-1");
    expect(overlay.foldCount).toBe(foldsAfterFirst);
  });
});
