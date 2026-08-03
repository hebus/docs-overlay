import { describe, expect, it } from "vitest";

import { metaFile, overlayOf, page } from "../testing/fixtures.js";

/**
 * Inheritance only — directives get their own suite. `1.0.0` is the base holding the complete
 * tree; later versions carry differences.
 */
const linear = [
  page("1.0.0/index.md"),
  page("1.0.0/guide/intro.md"),
  page("1.0.0/guide/stays.md"),
  page("1.0.0/api/a.md"),
  page("2.0.0/guide/intro.md"), // override
  page("3.0.0/api/b.md") // addition
];

describe("inheritance", () => {
  it("serves a page from the version that owns it", () => {
    const result = overlayOf(linear).resolve("1.0.0", "guide/intro");

    expect(result.kind).toBe("own");
    if (result.kind !== "own") return;
    expect(result.page.hops).toBe(0);
    expect(result.page.inherited).toBe(false);
    expect(result.page.source.definedIn).toBe("1.0.0");
  });

  it("reaches a page across several hops, naming the version that defines it", () => {
    // `guide/stays` is only ever written in 1.0.0, yet 3.0.0 must serve it.
    const result = overlayOf(linear).resolve("3.0.0", "guide/stays");

    expect(result.kind).toBe("inherited");
    if (result.kind !== "inherited") return;
    expect(result.page.hops).toBe(2);
    expect(result.page.inherited).toBe(true);
    expect(result.page.source.definedIn).toBe("1.0.0");
    expect(result.page.source.path).toBe("1.0.0/guide/stays.md");
  });

  it("stops at the nearest override rather than the original", () => {
    const overlay = overlayOf(linear);

    const own = overlay.resolve("2.0.0", "guide/intro");
    expect(own.kind).toBe("own");

    const inherited = overlay.resolve("3.0.0", "guide/intro");
    expect(inherited.kind).toBe("inherited");
    if (inherited.kind !== "inherited") return;
    expect(inherited.page.hops).toBe(1);
    expect(inherited.page.source.path).toBe("2.0.0/guide/intro.md");
  });

  it("leaves older versions untouched when a newer one overrides", () => {
    const overlay = overlayOf(linear);
    const result = overlay.resolve("1.0.0", "guide/intro");

    if (result.kind !== "own") throw new Error("expected own");
    expect(result.page.source.path).toBe("1.0.0/guide/intro.md");
    expect(result.page.meta["title"]).toBe("1.0.0/guide/intro.md");
  });

  it("does not leak a newer version's addition backwards", () => {
    const overlay = overlayOf(linear);
    expect(overlay.resolve("1.0.0", "api/b").kind).toBe("missing");
    expect(overlay.resolve("3.0.0", "api/b").kind).toBe("own");
  });

  it("shares the metadata object between versions instead of cloning it", () => {
    // A bundler emits one chunk per metadata object; cloning here would multiply it by version.
    const entry = page("1.0.0/guide/stays.md");
    const overlay = overlayOf([entry, page("2.0.0/other.md")]);

    const base = overlay.getPage("1.0.0", "guide/stays");
    const inherited = overlay.getPage("2.0.0", "guide/stays");
    expect(inherited?.meta).toBe(entry.meta);
    expect(inherited?.meta).toBe(base?.meta);
  });

  it("reports the browsing version on an inherited page, and the defining one on its source", () => {
    const inherited = overlayOf(linear).getPage("3.0.0", "guide/stays");
    expect(inherited?.version).toBe("3.0.0");
    expect(inherited?.source.definedIn).toBe("1.0.0");
  });
});

describe("getPages", () => {
  it("lists every page a version can serve, inherited ones included", () => {
    const slugs = (version: string) =>
      overlayOf(linear)
        .getPages(version)
        .map(entry => entry.slug.join("/"))
        .sort();

    expect(slugs("1.0.0")).toEqual(["", "api/a", "guide/intro", "guide/stays"]);
    expect(slugs("3.0.0")).toEqual(["", "api/a", "api/b", "guide/intro", "guide/stays"]);
  });

  it("is empty for an unknown version", () => {
    expect(overlayOf(linear).getPages("9.9.9")).toEqual([]);
  });
});

describe("metadata files", () => {
  it("inherits a meta file whole, rewritten into the browsing version's space", () => {
    const overlay = overlayOf([page("1.0.0/a.md"), metaFile("1.0.0/meta.json", { pages: ["a"] }), page("3.0.0/b.md")]);

    const inherited = overlay.getMeta("3.0.0", "");
    expect(inherited?.inherited).toBe(true);
    expect(inherited?.path).toBe("3.0.0/meta.json");
    expect(inherited?.source.path).toBe("1.0.0/meta.json");
    expect(inherited?.meta["pages"]).toEqual(["a"]);
  });

  it("prefers a version's own meta file", () => {
    const overlay = overlayOf([page("1.0.0/a.md"), metaFile("1.0.0/meta.json", { pages: ["a"] }), metaFile("3.0.0/meta.json", { pages: ["a", "b"] })]);

    const own = overlay.getMeta("3.0.0", "");
    expect(own?.inherited).toBe(false);
    expect(own?.meta["pages"]).toEqual(["a", "b"]);
  });

  it("inherits per directory, not as one blob", () => {
    const overlay = overlayOf([
      metaFile("1.0.0/meta.json", { pages: ["guide"] }),
      metaFile("1.0.0/guide/meta.json", { pages: ["intro"] }),
      metaFile("3.0.0/guide/meta.json", { pages: ["intro", "extra"] }),
      page("1.0.0/guide/intro.md")
    ]);

    expect(overlay.getMeta("3.0.0", "")?.inherited).toBe(true);
    expect(overlay.getMeta("3.0.0", "guide")?.inherited).toBe(false);
    expect(
      overlay
        .getMetas("3.0.0")
        .map(entry => entry.dir)
        .sort()
    ).toEqual(["", "guide"]);
  });
});

describe("branching chains", () => {
  it("keeps the two sides of a diamond independent", () => {
    // 11.13.1 is a hotfix off 11.13.0; an override landing in 11.14.0 must not reach it.
    const overlay = overlayOf([page("11.13.0/a.md"), page("11.13.1/b.md"), page("11.14.0/a.md")], { versions: { "11.14.0": { inheritsFrom: "11.13.0" } } });

    expect(overlay.getPage("11.13.1", "a")?.source.path).toBe("11.13.0/a.md");
    expect(overlay.getPage("11.14.0", "a")?.source.path).toBe("11.14.0/a.md");
    expect(overlay.resolve("11.14.0", "b").kind).toBe("missing");
  });
});

describe("channels", () => {
  it("gives an empty channel folder the full inherited tree", () => {
    // This is the state right after `git mv next 11.15.0 && mkdir next`.
    const overlay = overlayOf([page("1.0.0/a.md"), page("1.0.0/b.md")], { channels: ["next"] });

    expect(overlay.versions.map(version => version.id)).toEqual(["1.0.0", "next"]);
    expect(
      overlay
        .getPages("next")
        .map(entry => entry.slug.join("/"))
        .sort()
    ).toEqual(["a", "b"]);
    expect(overlay.resolve("next", "a").kind).toBe("inherited");
  });
});

describe("unknown versions", () => {
  it("is distinct from a missing page and points at a fallback", () => {
    const overlay = overlayOf([page("1.0.0/a.md"), page("11.14.0/b.md")]);

    const result = overlay.resolve("11.12.0", "a");
    expect(result.kind).toBe("unknown-version");
    if (result.kind !== "unknown-version") return;
    // Greatest existing version at or below the one asked for.
    expect(result.nearest).toBe("1.0.0");
  });

  it("falls back to the oldest release when the request predates everything", () => {
    const overlay = overlayOf([page("2.0.0/a.md"), page("3.0.0/b.md")]);
    const result = overlay.resolve("1.0.0", "a");

    if (result.kind !== "unknown-version") throw new Error("expected unknown-version");
    expect(result.nearest).toBe("2.0.0");
  });

  it("falls back to latest for a non-semver request", () => {
    const overlay = overlayOf([page("2.0.0/a.md"), page("3.0.0/b.md")]);
    const result = overlay.resolve("canary", "a");

    if (result.kind !== "unknown-version") throw new Error("expected unknown-version");
    expect(result.nearest).toBe("3.0.0");
  });
});

describe("overlay shape", () => {
  it("exposes versions oldest first with latest excluding channels", () => {
    const overlay = overlayOf([page("1.0.0/a.md"), page("11.14.0/a.md"), page("next/a.md")], { channels: ["next"] });

    expect(overlay.versions.map(version => version.id)).toEqual(["1.0.0", "11.14.0", "next"]);
    expect(overlay.latest?.id).toBe("11.14.0");
  });

  it("exposes the chain and the descendants of a version", () => {
    const overlay = overlayOf([page("1.0.0/a.md"), page("2.0.0/a.md"), page("3.0.0/a.md")]);

    expect(overlay.getChain("3.0.0").map(version => version.id)).toEqual(["3.0.0", "2.0.0", "1.0.0"]);
    expect(overlay.getDescendants("2.0.0")).toEqual(["2.0.0", "3.0.0"]);
  });

  it("has no redirects until a directive creates one", () => {
    expect(overlayOf(linear).getRedirects()).toEqual([]);
  });

  it("collects diagnostics without throwing", () => {
    const overlay = overlayOf([page("1.0.0/a.md"), page("draft/a.md")]);
    expect(overlay.diagnostics().map(entry => entry.code)).toEqual(["unknown-version-folder"]);
  });
});
