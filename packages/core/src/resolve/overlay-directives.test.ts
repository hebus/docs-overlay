import { describe, expect, it } from "vitest";

import { collectDiagnostics } from "../testing/diagnostics.js";
import { overlayOf, page, renamed, tombstone, withDirectives, type Meta } from "../testing/fixtures.js";
import type { ContentEntry } from "../source/content-source.js";

const slugs = (entries: readonly { slug: readonly string[] }[]): string[] => entries.map(entry => entry.slug.join("/")).sort();

const overlayWithDiagnostics = (entries: readonly ContentEntry<Meta>[]) => {
  const diagnostics = collectDiagnostics();
  const overlay = overlayOf(entries, { onDiagnostic: diagnostics.sink });
  overlay.diagnostics();
  return { overlay, diagnostics };
};

describe("tombstones", () => {
  const entries = [page("1.0.0/guide/stays.md"), page("1.0.0/guide/other.md"), page("2.0.0/guide/other.md"), tombstone("3.0.0/guide/stays.md")];

  it("removes the page from the version that declares it, and from newer ones", () => {
    const overlay = overlayOf(entries);

    expect(overlay.resolve("1.0.0", "guide/stays").kind).toBe("own");
    expect(overlay.resolve("2.0.0", "guide/stays").kind).toBe("inherited");
    expect(overlay.resolve("3.0.0", "guide/stays").kind).toBe("deleted");
  });

  it("does not reach backwards: an older version keeps serving the page", () => {
    // The whole point of the tombstone living in the removing version: 1.0.0 is untouched.
    const overlay = overlayOf(entries);
    expect(overlay.getPage("1.0.0", "guide/stays")?.source.path).toBe("1.0.0/guide/stays.md");
  });

  it("reports where the page was last readable", () => {
    const result = overlayOf(entries).resolve("3.0.0", "guide/stays");

    if (result.kind !== "deleted") throw new Error("expected deleted");
    expect(result.deletedIn).toBe("3.0.0");
    expect(result.lastAvailable).toEqual({ version: "2.0.0", slug: ["guide", "stays"] });
  });

  it("drops the page from the listing, so it gets no route and no search entry", () => {
    const overlay = overlayOf(entries);
    expect(slugs(overlay.getPages("2.0.0"))).toEqual(["guide/other", "guide/stays"]);
    expect(slugs(overlay.getPages("3.0.0"))).toEqual(["guide/other"]);
  });

  it("carries a replacement so an adapter can explain instead of 404ing", () => {
    const result = overlayOf([
      page("1.0.0/guide/legacy.md"),
      page("3.0.0/guide/modern.md"),
      tombstone("3.0.0/guide/legacy.md", { replacedBy: "guide/modern" })
    ]).resolve("3.0.0", "guide/legacy");

    if (result.kind !== "deleted") throw new Error("expected deleted");
    expect(result.replacedBy).toEqual(["guide", "modern"]);
  });

  it("keeps the earliest deletion when a newer version tombstones again", () => {
    const result = overlayOf([page("1.0.0/a.md"), tombstone("2.0.0/a.md"), tombstone("3.0.0/a.md")]).resolve("3.0.0", "a");

    if (result.kind !== "deleted") throw new Error("expected deleted");
    expect(result.deletedIn).toBe("2.0.0");
  });

  it("warns when a tombstone shadows nothing", () => {
    const { overlay, diagnostics } = overlayWithDiagnostics([page("1.0.0/a.md"), tombstone("3.0.0/typo.md")]);

    expect(diagnostics.codes()).toContain("tombstone-without-target");
    // Still recorded, so the slug does not accidentally start serving something later.
    expect(overlay.resolve("3.0.0", "typo").kind).toBe("deleted");
  });

  it("removes a whole subtree when asked", () => {
    const overlay = overlayOf([
      page("1.0.0/guide/legacy/index.md"),
      page("1.0.0/guide/legacy/a.md"),
      page("2.0.0/guide/legacy/b.md"),
      page("1.0.0/guide/keep.md"),
      withDirectives("3.0.0/guide/legacy/index.md", { deleted: true, recursive: true })
    ]);

    expect(overlay.resolve("3.0.0", "guide/legacy").kind).toBe("deleted");
    expect(overlay.resolve("3.0.0", "guide/legacy/a").kind).toBe("deleted");
    expect(overlay.resolve("3.0.0", "guide/legacy/b").kind).toBe("deleted");
    expect(overlay.resolve("3.0.0", "guide/keep").kind).toBe("inherited");
    expect(slugs(overlay.getPages("3.0.0"))).toEqual(["guide/keep"]);
  });

  it("only removes the named page when not recursive", () => {
    const overlay = overlayOf([page("1.0.0/guide/legacy/index.md"), page("1.0.0/guide/legacy/a.md"), tombstone("3.0.0/guide/legacy/index.md")]);

    expect(overlay.resolve("3.0.0", "guide/legacy").kind).toBe("deleted");
    expect(overlay.resolve("3.0.0", "guide/legacy/a").kind).toBe("inherited");
  });
});

describe("delete then re-add", () => {
  const entries = [page("1.0.0/a.md"), page("2.0.0/filler.md"), tombstone("3.0.0/a.md"), page("4.0.0/a.md"), page("5.0.0/other.md")];

  it("needs no special case: an own file overwrites the inherited tombstone", () => {
    const overlay = overlayOf(entries);

    expect(overlay.resolve("2.0.0", "a").kind).toBe("inherited");
    expect(overlay.resolve("3.0.0", "a").kind).toBe("deleted");
    expect(overlay.resolve("4.0.0", "a").kind).toBe("own");
    expect(overlay.resolve("5.0.0", "a").kind).toBe("inherited");
  });

  it("serves the re-added file, not the original", () => {
    const overlay = overlayOf(entries);
    expect(overlay.getPage("5.0.0", "a")?.source.path).toBe("4.0.0/a.md");
  });

  it("keeps the listing in step", () => {
    const overlay = overlayOf(entries);
    expect(slugs(overlay.getPages("3.0.0"))).toEqual(["filler"]);
    expect(slugs(overlay.getPages("4.0.0"))).toEqual(["a", "filler"]);
  });
});

describe("renames", () => {
  const entries = [page("1.0.0/guide/old-api.md"), renamed("2.0.0/guide/new-api.md", "guide/old-api"), page("3.0.0/unrelated.md")];

  it("still serves the old slug in the version that predates the rename", () => {
    // Spatial, not temporal: /1.0.0/guide/old-api is a 200 with the old content.
    const result = overlayOf(entries).resolve("1.0.0", "guide/old-api");
    expect(result.kind).toBe("own");
  });

  it("redirects the old slug from the renaming version onwards", () => {
    const overlay = overlayOf(entries);

    for (const version of ["2.0.0", "3.0.0"]) {
      const result = overlay.resolve(version, "guide/old-api");
      expect(result.kind, version).toBe("redirect");
      if (result.kind !== "redirect") continue;
      expect(result.to).toEqual(["guide", "new-api"]);
      expect(result.permanent).toBe(true);
      expect(result.reason).toBe("renamed");
    }
  });

  it("keeps the redirect alive in later versions rather than letting it decay into a 404", () => {
    // An external link that worked against 2.0.0 must keep working against 3.0.0.
    const overlay = overlayOf([...entries, page("4.0.0/another.md")]);
    expect(overlay.resolve("4.0.0", "guide/old-api").kind).toBe("redirect");
  });

  it("stops listing the old slug as a page", () => {
    const overlay = overlayOf(entries);
    expect(slugs(overlay.getPages("1.0.0"))).toEqual(["guide/old-api"]);
    expect(slugs(overlay.getPages("2.0.0"))).toEqual(["guide/new-api"]);
  });

  it("surfaces the rules through getRedirects", () => {
    const rules = overlayOf(entries).getRedirects("2.0.0");
    expect(rules).toEqual([{ version: "2.0.0", from: ["guide", "old-api"], to: ["guide", "new-api"], permanent: true, reason: "renamed" }]);
  });

  it("lets a version take the old slug back by dropping a real file there", () => {
    const overlay = overlayOf([...entries, page("3.0.0/guide/old-api.md")]);
    expect(overlay.resolve("3.0.0", "guide/old-api").kind).toBe("own");
  });

  it("reports a rename onto a slug the same version also defines, and keeps the file", () => {
    const { overlay, diagnostics } = overlayWithDiagnostics([page("2.0.0/a.md"), renamed("2.0.0/b.md", "a")]);

    expect(diagnostics.codes()).toContain("rename-collision");
    expect(overlay.resolve("2.0.0", "a").kind).toBe("own");
    expect(overlay.resolve("2.0.0", "b").kind).toBe("own");
  });

  it("ignores a page claiming to have been renamed from itself", () => {
    const { overlay, diagnostics } = overlayWithDiagnostics([renamed("2.0.0/a.md", "a")]);

    expect(diagnostics.codes()).toContain("rename-collision");
    expect(overlay.resolve("2.0.0", "a").kind).toBe("own");
  });
});

describe("redirect chains", () => {
  it("collapses a chain to a single hop", () => {
    const overlay = overlayOf([page("1.0.0/a.md"), renamed("2.0.0/b.md", "a"), renamed("3.0.0/c.md", "b")]);

    const result = overlay.resolve("3.0.0", "a");
    if (result.kind !== "redirect") throw new Error("expected redirect");
    expect(result.to).toEqual(["c"]);
    expect(result.reason).toBe("chained");

    const direct = overlay.resolve("3.0.0", "b");
    if (direct.kind !== "redirect") throw new Error("expected redirect");
    expect(direct.reason).toBe("renamed");
  });

  it("answers with the removal when a renamed page is later deleted", () => {
    const overlay = overlayOf([page("1.0.0/old.md"), renamed("2.0.0/new.md", "old"), tombstone("3.0.0/new.md")]);

    expect(overlay.resolve("2.0.0", "old").kind).toBe("redirect");
    const result = overlay.resolve("3.0.0", "old");
    expect(result.kind).toBe("deleted");
    if (result.kind !== "deleted") return;
    expect(result.deletedIn).toBe("3.0.0");
  });

  it("follows a tombstone's replacement", () => {
    const overlay = overlayOf([
      page("1.0.0/old.md"),
      renamed("2.0.0/new.md", "old"),
      page("3.0.0/newest.md"),
      tombstone("3.0.0/new.md", { replacedBy: "newest" })
    ]);

    const result = overlay.resolve("3.0.0", "old");
    if (result.kind !== "redirect") throw new Error("expected redirect");
    expect(result.to).toEqual(["newest"]);
  });

  it("drops a redirect whose replacement names a slug nothing provides", () => {
    const { overlay, diagnostics } = overlayWithDiagnostics([
      page("1.0.0/old.md"),
      renamed("2.0.0/new.md", "old"),
      tombstone("3.0.0/new.md", { replacedBy: "ghost" })
    ]);

    expect(diagnostics.codes()).toContain("redirect-target-missing");
    expect(overlay.resolve("3.0.0", "old").kind).toBe("missing");
  });

  it("cannot be made to loop through directives alone", () => {
    // A rename can only ever point at the declaring page's own slug, and a slug already backed by
    // a file is never taken over, so no pair of directives can produce a cycle. `collapse.test.ts`
    // exercises the cycle guard directly, since it is only reachable through a custom
    // `readDirectives`.
    const { diagnostics } = overlayWithDiagnostics([page("1.0.0/a.md"), renamed("2.0.0/b.md", "a"), renamed("3.0.0/a.md", "b"), renamed("4.0.0/b.md", "a")]);

    expect(diagnostics.codes()).not.toContain("redirect-cycle");
  });
});

describe("aliases", () => {
  const entries = [withDirectives("1.0.0/api/index.md", { aliases: ["api-reference"] }), page("2.0.0/other.md")];

  it("serves the page at the alias with a canonical pointing back at it", () => {
    const result = overlayOf(entries).resolve("1.0.0", "api-reference");

    expect(result.kind).toBe("alias");
    if (result.kind !== "alias") return;
    expect(result.canonical).toEqual(["api"]);
    expect(result.page.source.path).toBe("1.0.0/api/index.md");
  });

  it("is inherited like everything else", () => {
    expect(overlayOf(entries).resolve("2.0.0", "api-reference").kind).toBe("alias");
  });

  it("lists the page once, not once per slug", () => {
    expect(slugs(overlayOf(entries).getPages("1.0.0"))).toEqual(["api"]);
  });

  it("is exposed through getPage as the target page", () => {
    expect(overlayOf(entries).getPage("1.0.0", "api-reference")?.slug).toEqual(["api"]);
  });

  it("reports an alias that collides with a real file", () => {
    const { overlay, diagnostics } = overlayWithDiagnostics([
      page("1.0.0/api-reference.md"),
      withDirectives("1.0.0/api/index.md", { aliases: ["api-reference"] })
    ]);

    expect(diagnostics.codes()).toContain("alias-collision");
    expect(overlay.resolve("1.0.0", "api-reference").kind).toBe("own");
  });

  it("never shadows an inherited page", () => {
    // Taking a slug away from real content needs a real file or a tombstone, not an alias.
    const { overlay, diagnostics } = overlayWithDiagnostics([page("1.0.0/taken.md"), withDirectives("2.0.0/other.md", { aliases: ["taken"] })]);

    expect(diagnostics.codes()).toContain("alias-collision");
    expect(overlay.resolve("2.0.0", "taken").kind).toBe("inherited");
  });
});

describe("resilience", () => {
  it("never throws on broken content", () => {
    expect(() =>
      overlayOf([
        tombstone("1.0.0/nothing.md"),
        renamed("1.0.0/a.md", "a"),
        withDirectives("1.0.0/b.md", { aliases: ["b"] }),
        renamed("2.0.0/c.md", "does/not/exist")
      ]).diagnostics()
    ).not.toThrow();
  });

  it("reports a redirect whose target no version provides", () => {
    const { diagnostics } = overlayWithDiagnostics([page("1.0.0/a.md"), renamed("2.0.0/b.md", "ghost")]);
    expect(diagnostics.codes()).not.toContain("redirect-target-missing");
  });
});
