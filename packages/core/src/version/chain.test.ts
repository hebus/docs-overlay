import { describe, expect, it } from "vitest";

import { chainOf, descendantsOf, foldOrder } from "./chain.js";
import { orderVersions } from "./order.js";

const linear = orderVersions(["1.0.0", "2.0.0", "3.0.0", "next"], { channels: ["next"] });

// 11.13.1 is a hotfix branch off 11.13.0; 11.14.0 inherits from 11.13.0 as well.
const diamond = orderVersions(["11.13.0", "11.13.1", "11.14.0"], {
  overrides: { "11.14.0": { inheritsFrom: "11.13.0" } }
});

const ids = (versions: readonly { id: string }[]): string[] => versions.map(version => version.id);

describe("chainOf", () => {
  it("walks from the version towards the root of its chain", () => {
    expect(ids(chainOf(linear, "next"))).toEqual(["next", "3.0.0", "2.0.0", "1.0.0"]);
    expect(ids(chainOf(linear, "1.0.0"))).toEqual(["1.0.0"]);
  });

  it("follows the branch, not the sort order", () => {
    expect(ids(chainOf(diamond, "11.14.0"))).toEqual(["11.14.0", "11.13.0"]);
    expect(ids(chainOf(diamond, "11.13.1"))).toEqual(["11.13.1", "11.13.0"]);
  });

  it("is empty for an unknown version", () => {
    expect(chainOf(linear, "9.9.9")).toEqual([]);
  });
});

describe("foldOrder", () => {
  it("puts every parent before its children", () => {
    for (const versions of [linear, diamond]) {
      const seen = new Set<string>();
      for (const version of foldOrder(versions)) {
        if (version.inheritsFrom !== undefined) expect(seen).toContain(version.inheritsFrom);
        seen.add(version.id);
      }
    }
  });

  it("emits every version exactly once", () => {
    expect(foldOrder(diamond)).toHaveLength(diamond.length);
    expect(new Set(ids(foldOrder(diamond))).size).toBe(diamond.length);
  });

  it("works when a parent sorts after its child", () => {
    // Reverse overlay: the newest version is the base. Sorting by `order` alone would fold
    // children before parents here.
    const reverse = orderVersions(["1.0.0", "2.0.0"], { compareVersions: (a, b) => b.localeCompare(a) });
    expect(ids(foldOrder(reverse))).toEqual(["2.0.0", "1.0.0"]);
  });
});

describe("descendantsOf", () => {
  it("includes the version itself and everything inheriting through it", () => {
    expect(descendantsOf(linear, "2.0.0")).toEqual(["2.0.0", "3.0.0", "next"]);
    expect(descendantsOf(linear, "next")).toEqual(["next"]);
  });

  it("spans both sides of a diamond", () => {
    expect([...descendantsOf(diamond, "11.13.0")].sort()).toEqual(["11.13.0", "11.13.1", "11.14.0"]);
    expect(descendantsOf(diamond, "11.13.1")).toEqual(["11.13.1"]);
  });

  it("is empty for an unknown version", () => {
    expect(descendantsOf(linear, "9.9.9")).toEqual([]);
  });
});
