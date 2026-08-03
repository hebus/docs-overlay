import { describe, expect, it } from "vitest";

import { compareSemver, isStableSemver, parseSemver, type SemverParts } from "./semver.js";

const parse = (id: string): SemverParts => {
  const parts = parseSemver(id);
  if (parts === undefined) throw new Error(`expected "${id}" to parse as semver`);
  return parts;
};

const order = (a: string, b: string): number => compareSemver(parse(a), parse(b));

describe("parseSemver", () => {
  it("parses a full version", () => {
    expect(parseSemver("11.14.0")).toEqual([11, 14, 0]);
  });

  it("fills in omitted minor and patch, so `2` and `3.1` are usable folder names", () => {
    expect(parseSemver("2")).toEqual([2, 0, 0]);
    expect(parseSemver("3.1")).toEqual([3, 1, 0]);
  });

  it("tolerates a leading v", () => {
    expect(parseSemver("v1.2.3")).toEqual([1, 2, 3]);
  });

  it("keeps the prerelease and discards build metadata", () => {
    expect(parseSemver("2.0.0-next.1")).toEqual([2, 0, 0, "next.1"]);
    expect(parseSemver("2.0.0+build.5")).toEqual([2, 0, 0]);
  });

  it("returns undefined for a channel name", () => {
    expect(parseSemver("next")).toBeUndefined();
    expect(parseSemver("11.x")).toBeUndefined();
    expect(parseSemver("")).toBeUndefined();
  });
});

describe("compareSemver", () => {
  // The whole point of not sorting folder names as strings: mint-internal really does have
  // 11.6.1 through 11.14.0 side by side.
  it("orders numerically, not lexicographically", () => {
    expect(order("11.9.0", "11.10.0")).toBeLessThan(0);
    expect(order("11.6.1", "11.14.0")).toBeLessThan(0);
    expect(order("2.0.0", "10.0.0")).toBeLessThan(0);
  });

  it("is reflexive and antisymmetric", () => {
    expect(order("1.2.3", "1.2.3")).toBe(0);
    expect(order("1.2.4", "1.2.3")).toBeGreaterThan(0);
  });

  it("ranks a prerelease below the release it precedes", () => {
    expect(order("2.0.0-next.1", "2.0.0")).toBeLessThan(0);
    expect(order("2.0.0", "2.0.0-next.1")).toBeGreaterThan(0);
  });

  it("compares prerelease identifiers per the spec", () => {
    expect(order("2.0.0-alpha", "2.0.0-beta")).toBeLessThan(0);
    expect(order("2.0.0-next.2", "2.0.0-next.10")).toBeLessThan(0);
    expect(order("2.0.0-next.1", "2.0.0-next.1.1")).toBeLessThan(0);
    expect(order("2.0.0-1", "2.0.0-alpha")).toBeLessThan(0);
  });

  it("sorts a realistic set oldest first", () => {
    const ids = ["11.14.0", "11.9.0", "2.0.0-next.1", "11.10.0", "2.0.0", "11.6.1"];
    expect([...ids].sort((a, b) => order(a, b))).toEqual(["2.0.0-next.1", "2.0.0", "11.6.1", "11.9.0", "11.10.0", "11.14.0"]);
  });
});

describe("isStableSemver", () => {
  it("accepts releases only", () => {
    expect(isStableSemver("1.0.0")).toBe(true);
    expect(isStableSemver("1.0.0-rc.1")).toBe(false);
    expect(isStableSemver("next")).toBe(false);
  });
});
