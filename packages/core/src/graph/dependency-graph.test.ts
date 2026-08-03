import { describe, expect, it } from "vitest";

import { metaFile, overlayOf, page, renamed, tombstone, withDirectives } from "../testing/fixtures.js";

const at = (dependents: readonly { version: string; kind: string }[], version: string) => dependents.filter(entry => entry.version === version);

describe("getDependents", () => {
  it("names every version that reads a file", () => {
    const overlay = overlayOf([page("1.0.0/a.md"), page("2.0.0/b.md"), page("3.0.0/c.md")]);

    expect(overlay.getDependents("1.0.0/a.md").map(entry => entry.version)).toEqual(["1.0.0", "2.0.0", "3.0.0"]);
  });

  it("stops at the version that overrides the slug", () => {
    const overlay = overlayOf([page("1.0.0/a.md"), page("3.0.0/a.md"), page("4.0.0/filler.md")]);

    expect(overlay.getDependents("1.0.0/a.md").map(entry => entry.version)).toEqual(["1.0.0"]);
    expect(overlay.getDependents("3.0.0/a.md").map(entry => entry.version)).toEqual(["3.0.0", "4.0.0"]);
  });

  it("stops at the version that tombstones the slug", () => {
    const overlay = overlayOf([page("1.0.0/a.md"), page("2.0.0/filler.md"), tombstone("3.0.0/a.md")]);

    expect(overlay.getDependents("1.0.0/a.md").map(entry => entry.version)).toEqual(["1.0.0", "2.0.0"]);
  });

  it("attributes the removal to the tombstone, including a whole subtree", () => {
    const overlay = overlayOf([
      page("1.0.0/guide/legacy/index.md"),
      page("1.0.0/guide/legacy/a.md"),
      withDirectives("3.0.0/guide/legacy/index.md", { deleted: true, recursive: true })
    ]);

    const dependents = overlay.getDependents("3.0.0/guide/legacy/index.md");
    expect(dependents.every(entry => entry.kind === "deleted")).toBe(true);
    expect(dependents.map(entry => (entry.kind === "meta" ? entry.dir : entry.slug.join("/"))).sort()).toEqual(["guide/legacy", "guide/legacy/a"]);
  });

  it("attributes a redirect to the frontmatter that declared it, not to the page it points at", () => {
    // Editing `renamedFrom` is what changes the rule, so that file is the dependency.
    const overlay = overlayOf([page("1.0.0/old.md"), renamed("2.0.0/new.md", "old")]);

    const dependents = overlay.getDependents("2.0.0/new.md");
    expect(
      at(dependents, "2.0.0")
        .map(entry => entry.kind)
        .sort()
    ).toEqual(["page", "redirect"]);
    expect(overlay.getDependents("1.0.0/old.md").map(entry => entry.version)).toEqual(["1.0.0"]);
  });

  it("attributes an alias to the file declaring it", () => {
    const overlay = overlayOf([withDirectives("1.0.0/api/index.md", { aliases: ["api-reference"] })]);

    const kinds = overlay
      .getDependents("1.0.0/api/index.md")
      .map(entry => entry.kind)
      .sort();
    expect(kinds).toEqual(["alias", "page"]);
  });

  it("tracks metadata files, keyed by the directory they govern", () => {
    const overlay = overlayOf([page("1.0.0/a.md"), metaFile("1.0.0/guide/meta.json"), page("2.0.0/b.md")]);

    const dependents = overlay.getDependents("1.0.0/guide/meta.json");
    expect(dependents).toEqual([
      { kind: "meta", version: "1.0.0", dir: "guide" },
      { kind: "meta", version: "2.0.0", dir: "guide" }
    ]);
  });

  it("covers both sides of a branching chain", () => {
    const overlay = overlayOf([page("11.13.0/a.md"), page("11.13.1/b.md"), page("11.14.0/c.md")], {
      versions: { "11.14.0": { inheritsFrom: "11.13.0" } }
    });

    expect(
      overlay
        .getDependents("11.13.0/a.md")
        .map(entry => entry.version)
        .sort()
    ).toEqual(["11.13.0", "11.13.1", "11.14.0"]);
  });

  it("is empty for a file nothing reads", () => {
    expect(overlayOf([page("1.0.0/a.md")]).getDependents("1.0.0/ghost.md")).toEqual([]);
  });
});
