import { describe, expect, it } from "vitest";

import { createOverlay } from "./create-overlay.js";
import type { Dependent, EntryDependent } from "./graph/dependency-graph.js";
import { mutableSource, page, tombstone, type Meta } from "./testing/fixtures.js";

const overlayOver = (source: ReturnType<typeof mutableSource>) => createOverlay<Meta>({ source: source.source, channels: ["next"] });

/** `version:slug` for every page entry, which is what a dev server needs in order to refresh routes. */
const pageSlugs = (dependents: readonly Dependent[]): string[] =>
  dependents.filter((entry): entry is EntryDependent => entry.kind === "page").map(entry => `${entry.version}:${entry.slug.join("/")}`);

describe("memoisation", () => {
  it("folds a version once, however often it is queried", () => {
    const source = mutableSource([page("1.0.0/a.md"), page("2.0.0/b.md")]);
    const overlay = overlayOver(source);

    overlay.getPages("2.0.0");
    overlay.getPages("2.0.0");
    overlay.resolve("2.0.0", "a");

    // 2.0.0 plus its parent, folded once each.
    expect(overlay.foldCount).toBe(2);
  });

  it("does not fold a version nobody asks about", () => {
    const source = mutableSource([page("1.0.0/a.md"), page("2.0.0/b.md"), page("3.0.0/c.md")]);
    const overlay = overlayOver(source);

    overlay.resolve("1.0.0", "a");
    expect(overlay.foldCount).toBe(1);
  });

  it("reads the source once up front", () => {
    const source = mutableSource([page("1.0.0/a.md")]);
    const overlay = overlayOver(source);

    overlay.getPages("1.0.0");
    overlay.diagnostics();
    expect(source.reads).toBe(1);
  });
});

describe("invalidate", () => {
  it("throws away the changed version and everything downstream, and nothing else", () => {
    const source = mutableSource([page("1.0.0/a.md"), page("2.0.0/b.md"), page("3.0.0/c.md"), page("4.0.0/d.md")]);
    const overlay = overlayOver(source);

    source.replace(page("2.0.0/b.md", { title: "edited" }));
    const result = overlay.invalidate(["2.0.0/b.md"]);

    expect([...result.versions].sort()).toEqual(["2.0.0", "3.0.0", "4.0.0", "next"]);
    expect(result.versions).not.toContain("1.0.0");
    expect(result.structural).toBe(false);
  });

  it("serves the new content afterwards", () => {
    const source = mutableSource([page("1.0.0/a.md")]);
    const overlay = overlayOver(source);
    expect(overlay.getPage("1.0.0", "a")?.meta["title"]).toBe("1.0.0/a.md");

    source.replace(page("1.0.0/a.md", { title: "edited" }));
    overlay.invalidate(["1.0.0/a.md"]);

    expect(overlay.getPage("1.0.0", "a")?.meta["title"]).toBe("edited");
  });

  it("touching the newest version leaves its ancestors alone", () => {
    const source = mutableSource([page("1.0.0/a.md"), page("2.0.0/b.md")]);
    const overlay = overlayOver(source);

    const result = overlay.invalidate(["next/new.md"]);
    expect(result.versions).toEqual(["next"]);
  });

  it("reports the impact of a deleted file, measured before the state is discarded", () => {
    // Asking after the rebuild would return the new — empty — answer, and a dev server would never
    // learn which routes to refresh.
    const source = mutableSource([page("1.0.0/a.md"), page("2.0.0/b.md"), page("3.0.0/c.md")]);
    const overlay = overlayOver(source);

    source.remove("1.0.0/a.md");
    const result = overlay.invalidate(["1.0.0/a.md"]);

    const slugs = pageSlugs(result.dependents);
    expect(slugs).toContain("1.0.0:a");
    expect(slugs).toContain("3.0.0:a");
    expect(overlay.resolve("3.0.0", "a").kind).toBe("missing");
  });

  it("reports the impact of a file that did not exist before", () => {
    const source = mutableSource([page("1.0.0/a.md"), page("2.0.0/b.md")]);
    const overlay = overlayOver(source);

    source.add(page("1.0.0/fresh.md"));
    const result = overlay.invalidate(["1.0.0/fresh.md"]);

    const slugs = pageSlugs(result.dependents);
    expect(slugs).toContain("1.0.0:fresh");
    expect(slugs).toContain("2.0.0:fresh");
  });

  it("flags a change to the set of versions as structural", () => {
    const source = mutableSource([page("1.0.0/a.md")]);
    const overlay = overlayOver(source);
    expect(overlay.versions.map(version => version.id)).toEqual(["1.0.0", "next"]);

    source.add(page("2.0.0/b.md"));
    const result = overlay.invalidate(["2.0.0/b.md"]);

    expect(result.structural).toBe(true);
    expect([...result.versions].sort()).toEqual(["1.0.0", "2.0.0", "next"]);
    expect(overlay.versions.map(version => version.id)).toEqual(["1.0.0", "2.0.0", "next"]);
  });

  it("flags the disappearance of a version as structural too", () => {
    const source = mutableSource([page("1.0.0/a.md"), page("2.0.0/only.md")]);
    const overlay = overlayOver(source);

    source.remove("2.0.0/only.md");
    const result = overlay.invalidate(["2.0.0/only.md"]);

    expect(result.structural).toBe(true);
    expect(overlay.versions.map(version => version.id)).toEqual(["1.0.0", "next"]);
  });

  it("rebuilds everything when called with no argument", () => {
    const source = mutableSource([page("1.0.0/a.md"), page("2.0.0/b.md")]);
    const overlay = overlayOver(source);
    overlay.diagnostics();

    const result = overlay.invalidate();

    expect([...result.versions].sort()).toEqual(["1.0.0", "2.0.0", "next"]);
    expect(source.reads).toBe(2);
  });

  it("picks up a newly added tombstone", () => {
    const source = mutableSource([page("1.0.0/a.md"), page("2.0.0/b.md"), page("3.0.0/c.md")]);
    const overlay = overlayOver(source);
    expect(overlay.resolve("3.0.0", "a").kind).toBe("inherited");

    source.add(tombstone("3.0.0/a.md"));
    overlay.invalidate(["3.0.0/a.md"]);

    expect(overlay.resolve("3.0.0", "a").kind).toBe("deleted");
    expect(overlay.resolve("2.0.0", "a").kind).toBe("inherited");
  });

  it("does not report a version the change cannot reach", () => {
    const source = mutableSource([page("11.13.0/a.md"), page("11.13.1/hotfix.md"), page("11.14.0/c.md")]);
    const overlay = createOverlay<Meta>({ source: source.source, versions: { "11.14.0": { inheritsFrom: "11.13.0" } } });

    source.replace(page("11.13.1/hotfix.md", { title: "edited" }));
    const result = overlay.invalidate(["11.13.1/hotfix.md"]);

    expect(result.versions).toEqual(["11.13.1"]);
  });
});
