import { describe, expect, it } from "vitest";

import { collectDiagnostics } from "../testing/diagnostics.js";
import { latestVersion, orderVersions } from "./order.js";

const ids = (versions: readonly { id: string }[]): string[] => versions.map(version => version.id);

describe("orderVersions", () => {
  it("returns versions oldest first, so index 0 is the base", () => {
    const versions = orderVersions(["11.14.0", "11.9.0", "11.10.0"]);
    expect(ids(versions)).toEqual(["11.9.0", "11.10.0", "11.14.0"]);
    expect(versions[0]?.order).toBe(0);
    expect(versions[0]?.inheritsFrom).toBeUndefined();
  });

  it("places declared channels after every released version, in declaration order", () => {
    const versions = orderVersions(["next", "1.0.0", "beta", "2.0.0"], { channels: ["beta", "next"] });
    expect(ids(versions)).toEqual(["1.0.0", "2.0.0", "beta", "next"]);
    expect(versions.at(-1)?.channel).toBe("next");
    expect(versions.at(-1)?.semver).toBeUndefined();
  });

  it("ignores an undeclared non-semver folder and says so, rather than crashing", () => {
    const diagnostics = collectDiagnostics();
    const versions = orderVersions(["1.0.0", "draft"], { onDiagnostic: diagnostics.sink });

    expect(ids(versions)).toEqual(["1.0.0"]);
    expect(diagnostics.codes()).toEqual(["unknown-version-folder"]);
    expect(diagnostics.all[0]?.version).toBe("draft");
  });

  it("chains each version onto the previous one by default", () => {
    const versions = orderVersions(["1.0.0", "2.0.0", "next"], { channels: ["next"] });
    expect(versions.map(version => [version.id, version.inheritsFrom])).toEqual([
      ["1.0.0", undefined],
      ["2.0.0", "1.0.0"],
      ["next", "2.0.0"]
    ]);
  });

  it("de-duplicates and skips empty ids", () => {
    expect(ids(orderVersions(["1.0.0", "1.0.0", ""]))).toEqual(["1.0.0"]);
  });

  it("warns when two ids compare as equal but still returns a stable order", () => {
    const diagnostics = collectDiagnostics();
    const versions = orderVersions(["2.0.0", "2"], { onDiagnostic: diagnostics.sink });

    expect(diagnostics.codes()).toContain("ambiguous-version-order");
    expect(ids(versions)).toEqual(["2", "2.0.0"]);
  });

  it("honours a custom comparator over every accepted id", () => {
    // Reverse order: newest first. The core does not care which direction the overlay runs in.
    const versions = orderVersions(["1.0.0", "2.0.0", "3.0.0"], {
      compareVersions: (a, b) => b.localeCompare(a)
    });
    expect(ids(versions)).toEqual(["3.0.0", "2.0.0", "1.0.0"]);
    expect(versions[1]?.inheritsFrom).toBe("3.0.0");
  });

  it("carries the caller's opaque meta through untouched", () => {
    const meta = { label: "11.14.0 (LTS)" };
    const versions = orderVersions(["11.14.0"], { overrides: { "11.14.0": { meta } } });
    expect(versions[0]?.meta).toBe(meta);
  });
});

describe("orderVersions inheritance overrides", () => {
  it("models a maintenance branch as a diamond", () => {
    // 11.13.1 is a hotfix off 11.13.0; 11.14.0 must not inherit through it.
    const versions = orderVersions(["11.13.0", "11.13.1", "11.14.0"], {
      overrides: { "11.14.0": { inheritsFrom: "11.13.0" } }
    });

    expect(versions.map(version => [version.id, version.inheritsFrom])).toEqual([
      ["11.13.0", undefined],
      ["11.13.1", "11.13.0"],
      ["11.14.0", "11.13.0"]
    ]);
  });

  it("reports an override pointing at a missing version and keeps the default chain", () => {
    const diagnostics = collectDiagnostics();
    const versions = orderVersions(["1.0.0", "2.0.0"], {
      overrides: { "2.0.0": { inheritsFrom: "0.9.0" } },
      onDiagnostic: diagnostics.sink
    });

    expect(diagnostics.codes()).toEqual(["inherits-from-unknown"]);
    expect(versions[1]?.inheritsFrom).toBe("1.0.0");
  });

  it("cuts an inheritance cycle instead of overflowing the stack", () => {
    const diagnostics = collectDiagnostics();
    const versions = orderVersions(["1.0.0", "2.0.0"], {
      overrides: { "1.0.0": { inheritsFrom: "2.0.0" }, "2.0.0": { inheritsFrom: "1.0.0" } },
      onDiagnostic: diagnostics.sink
    });

    expect(diagnostics.codes()).toEqual(["inheritance-cycle"]);
    const roots = versions.filter(version => version.inheritsFrom === undefined);
    expect(roots).toHaveLength(1);
  });

  it("ignores an override for a version that does not exist", () => {
    const diagnostics = collectDiagnostics();
    const versions = orderVersions(["1.0.0"], { overrides: { "9.9.9": { inheritsFrom: "1.0.0" } }, onDiagnostic: diagnostics.sink });

    expect(ids(versions)).toEqual(["1.0.0"]);
    expect(diagnostics.all).toEqual([]);
  });
});

describe("latestVersion", () => {
  it("is the highest release, ignoring channels", () => {
    const versions = orderVersions(["1.0.0", "11.14.0", "next"], { channels: ["next"] });
    expect(latestVersion(versions)?.id).toBe("11.14.0");
  });

  it("ignores prereleases when a release exists", () => {
    const versions = orderVersions(["1.0.0", "2.0.0-rc.1"]);
    expect(latestVersion(versions)?.id).toBe("1.0.0");
  });

  it("falls back to the newest prerelease when nothing is released", () => {
    const versions = orderVersions(["2.0.0-rc.1", "2.0.0-rc.2", "next"], { channels: ["next"] });
    expect(latestVersion(versions)?.id).toBe("2.0.0-rc.2");
  });

  it("is undefined when only channels exist", () => {
    expect(latestVersion(orderVersions(["next"], { channels: ["next"] }))).toBeUndefined();
    expect(latestVersion([])).toBeUndefined();
  });
});
