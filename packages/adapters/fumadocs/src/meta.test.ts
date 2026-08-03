import { loader } from "fumadocs-core/source";
import type { MetaData } from "fumadocs-core/source";
import { describe, expect, it } from "vitest";

import { strictMeta } from "./meta.js";
import { overlaySource, type OverlayFumadocsOptions } from "./overlay-source.js";
import { findOrphanPages } from "./diagnostics.js";
import { versionTabs, versionTree } from "./tabs.js";
import { fakeStaticSource, fumadocsMeta, fumadocsPage } from "./testing/fake-source.js";

const build = (options: Partial<OverlayFumadocsOptions> & Pick<OverlayFumadocsOptions, "source">) => {
  const overlay = overlaySource(options);
  const source = loader({ baseUrl: "/docs", source: overlay.source, url: overlay.url });
  return { overlay, source };
};

const metaAt = (files: readonly { type: string; path: string; data: unknown }[], path: string): MetaData | undefined =>
  files.find(file => file.type === "meta" && file.path === path)?.data as MetaData | undefined;

describe("inherited navigation lists", () => {
  /**
   * The failure this guards against. `atomic-angular/docs-site/content/docs/atomic-angular/meta.json`
   * lists its sixteen pages with **no** `"..."`, so inheriting it into a version that added a page
   * routes and indexes that page while leaving it out of the sidebar. Silent, and likely.
   */
  const content = fakeStaticSource(
    fumadocsPage("1.0.0/guide/intro.md"),
    fumadocsPage("1.0.0/guide/setup.md"),
    fumadocsMeta("1.0.0/guide/meta.json", { pages: ["intro", "setup"] }),
    fumadocsPage("3.0.0/guide/added.md")
  );

  it("completes the list so a newly added page stays visible", () => {
    const { overlay, source } = build({ source: content });

    expect(metaAt(overlay.source.files, "3.0.0/guide/meta.json")?.pages).toEqual(["intro", "setup", "..."]);
    expect(findOrphanPages(source)).toEqual([]);
    expect(JSON.stringify(versionTree(source, "3.0.0"))).toContain("/docs/3.0.0/guide/added");
  });

  it("leaves the authoring version's own list untouched", () => {
    const { overlay } = build({ source: content });
    expect(metaAt(overlay.source.files, "1.0.0/guide/meta.json")?.pages).toEqual(["intro", "setup"]);
  });

  it("says so, rather than adjusting the navigation silently", () => {
    const { overlay } = build({ source: content });
    const reported = overlay.diagnostics.find(entry => entry.code === "meta-pages-completed");

    expect(reported?.version).toBe("3.0.0");
    expect(reported?.message).toContain('"added"');
  });

  it("keeps a deliberate omission omitted", () => {
    // `setup` is missing from the list in the version that wrote it, so it was meant to be hidden.
    const hidden = fakeStaticSource(
      fumadocsPage("1.0.0/guide/intro.md"),
      fumadocsPage("1.0.0/guide/setup.md"),
      fumadocsMeta("1.0.0/guide/meta.json", { pages: ["intro"] }),
      fumadocsPage("3.0.0/guide/other.md")
    );
    const { overlay } = build({ source: hidden });

    expect(metaAt(overlay.source.files, "3.0.0/guide/meta.json")?.pages).toEqual(["intro", "..."]);
    expect(overlay.diagnostics.filter(entry => entry.code === "meta-pages-completed").map(entry => entry.message)).toHaveLength(1);
  });

  it("does not touch a list that already declares a rest sentinel", () => {
    const withRest = fakeStaticSource(
      fumadocsPage("1.0.0/guide/intro.md"),
      fumadocsMeta("1.0.0/guide/meta.json", { pages: ["intro", "..."] }),
      fumadocsPage("3.0.0/guide/added.md")
    );
    const { overlay } = build({ source: withRest });

    expect(metaAt(overlay.source.files, "3.0.0/guide/meta.json")?.pages).toEqual(["intro", "..."]);
    expect(overlay.diagnostics.some(entry => entry.code === "meta-pages-completed")).toBe(false);
  });

  it("does not touch a list with no additions to account for", () => {
    const unchanged = fakeStaticSource(
      fumadocsPage("1.0.0/guide/intro.md"),
      fumadocsMeta("1.0.0/guide/meta.json", { pages: ["intro"] }),
      fumadocsPage("3.0.0/elsewhere.md")
    );
    const { overlay } = build({ source: unchanged });

    expect(metaAt(overlay.source.files, "3.0.0/guide/meta.json")?.pages).toEqual(["intro"]);
  });

  it("with strictMeta, the page is routed but unreachable — and reported as an orphan", () => {
    const { overlay, source } = build({ source: content, mergeMeta: strictMeta() });

    expect(metaAt(overlay.source.files, "3.0.0/guide/meta.json")?.pages).toEqual(["intro", "setup"]);
    expect(source.getPage(["3.0.0", "guide", "added"])).toBeDefined();

    const orphans = findOrphanPages(source);
    expect(orphans.map(entry => entry.message)).toHaveLength(1);
    expect(orphans[0]?.message).toContain("/docs/3.0.0/guide/added");
    expect(orphans[0]?.version).toBe("3.0.0");
  });

  it("drops an entry naming a page the browsing version removed", () => {
    // Verified upstream behaviour: `resolveFolderItem` silently ignores an unresolvable entry, so a
    // tombstoned page listed in an inherited `meta.json` leaves no ghost node.
    const removed = fakeStaticSource(
      fumadocsPage("1.0.0/guide/intro.md"),
      fumadocsPage("1.0.0/guide/legacy.md"),
      fumadocsMeta("1.0.0/guide/meta.json", { pages: ["intro", "legacy"] }),
      fumadocsPage("3.0.0/guide/legacy.md", { overlay: { deleted: true } })
    );
    const { source } = build({ source: removed });

    const tree = versionTree(source, "3.0.0");
    expect(JSON.stringify(tree)).not.toContain("legacy");
  });
});

describe("synthesised metadata", () => {
  const content = fakeStaticSource(fumadocsPage("1.0.0/a.md"), fumadocsPage("2.0.0/b.md"));

  it("marks each version folder as a sidebar root", () => {
    const { overlay } = build({ source: content });

    expect(metaAt(overlay.source.files, "1.0.0/meta.json")).toEqual({ root: true, title: "1.0.0" });
    expect(metaAt(overlay.source.files, "2.0.0/meta.json")).toEqual({ root: true, title: "2.0.0" });
  });

  it("merges root:true into a meta file the author provided", () => {
    const withRoot = fakeStaticSource(fumadocsPage("1.0.0/a.md"), fumadocsMeta("1.0.0/meta.json", { title: "Version one", pages: ["a"] }));
    const { overlay } = build({ source: withRoot });

    expect(metaAt(overlay.source.files, "1.0.0/meta.json")).toEqual({ title: "Version one", pages: ["a"], root: true });
  });

  it("orders the versions newest first at the site root", () => {
    // localeCompare would put 11.10.0 before 11.9.0; mint-internal really has 11.6.1 to 11.14.0.
    const many = fakeStaticSource(fumadocsPage("11.6.1/a.md"), fumadocsPage("11.9.0/a.md"), fumadocsPage("11.10.0/a.md"), fumadocsPage("11.14.0/a.md"));
    const { overlay } = build({ source: many, channels: ["next"] });

    expect(metaAt(overlay.source.files, "meta.json")?.pages).toEqual(["next", "11.14.0", "11.10.0", "11.9.0", "11.6.1"]);
  });

  it("can order them oldest first, or not at all", () => {
    expect(metaAt(overlaySource({ source: content, orderVersions: "asc" }).source.files, "meta.json")?.pages).toEqual(["1.0.0", "2.0.0"]);
    expect(metaAt(overlaySource({ source: content, orderVersions: false }).source.files, "meta.json")).toBeUndefined();
  });

  it("can leave the version folders unmarked, merging every version into one tree", () => {
    const { overlay } = build({ source: content, rootPerVersion: false });
    expect(metaAt(overlay.source.files, "1.0.0/meta.json")).toBeUndefined();
  });

  it("uses the version label as the root title", () => {
    const { overlay } = build({ source: content, labels: { "2.0.0": "2.x (LTS)" } });
    expect(metaAt(overlay.source.files, "2.0.0/meta.json")?.title).toBe("2.x (LTS)");
  });
});

describe("versionTree", () => {
  const content = fakeStaticSource(fumadocsPage("1.0.0/a.md"), fumadocsPage("1.0.0/guide/intro.md"), fumadocsPage("3.0.0/b.md"));

  it("scopes the tree to one version", () => {
    const { source } = build({ source: content });

    const serialised = JSON.stringify(versionTree(source, "3.0.0"));
    expect(serialised).toContain("/docs/3.0.0/a");
    expect(serialised).not.toContain("/docs/1.0.0/");
  });

  it("returns an empty tree for an unknown segment rather than throwing", () => {
    const { source } = build({ source: content });
    expect(versionTree(source, "9.9.9")).toEqual({ name: "9.9.9", children: [] });
  });
});

describe("versionTabs", () => {
  const content = fakeStaticSource(fumadocsPage("1.0.0/a.md"), fumadocsPage("2.0.0/a.md"));

  it("is newest first and carries only what a switcher needs", () => {
    // Explicitly built rather than auto-detected: getSidebarTabs() would serialise every URL of
    // every version into the client bundle.
    const { overlay } = build({ source: content, channels: ["next"], labels: { next: "Next 🚧" } });

    expect(versionTabs(overlay)).toEqual([
      { title: "Next 🚧", url: "/docs/next", version: "next", isLatest: false, isChannel: true },
      { title: "2.0.0", url: "/docs/2.0.0", version: "2.0.0", isLatest: true, isChannel: false },
      { title: "1.0.0", url: "/docs/1.0.0", version: "1.0.0", isLatest: false, isChannel: false }
    ]);
  });

  it("can be ordered oldest first", () => {
    const { overlay } = build({ source: content });
    expect(versionTabs(overlay, { newestFirst: false }).map(tab => tab.version)).toEqual(["1.0.0", "2.0.0"]);
  });
});
