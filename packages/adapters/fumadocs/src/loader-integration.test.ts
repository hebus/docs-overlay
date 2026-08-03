import { loader } from "fumadocs-core/source";
import { describe, expect, it } from "vitest";

import { overlaySource, type OverlayFumadocsOptions } from "./overlay-source.js";
import { fakeStaticSource, fumadocsMeta, fumadocsPage } from "./testing/fake-source.js";

/**
 * These run against the real `loader()` from `fumadocs-core`, with no Next.js and no MDX
 * compilation. That is the whole point: the contract that matters is the one Fumadocs actually
 * implements, not the one its documentation describes.
 */
const content = fakeStaticSource(
  fumadocsPage("1.0.0/index.md"),
  fumadocsPage("1.0.0/guide/intro.md"),
  fumadocsPage("1.0.0/guide/b.md"),
  fumadocsPage("1.0.0/guide/stays.md"),
  fumadocsMeta("1.0.0/meta.json", { pages: ["guide"] }),
  fumadocsPage("2.0.0/guide/intro.md"),
  fumadocsPage("3.0.0/api/new.md")
);

const build = (options: Partial<OverlayFumadocsOptions> = {}) => {
  const overlay = overlaySource({ source: content, channels: ["next"], ...options });
  const source = loader({ baseUrl: "/docs", source: overlay.source, url: overlay.url });
  return { overlay, source };
};

describe("loader integration", () => {
  it("serves an inherited page under the browsing version's slugs", () => {
    const { source } = build();
    const page = source.getPage(["3.0.0", "guide", "stays"]);

    expect(page).toBeDefined();
    expect(page?.url).toBe("/docs/3.0.0/guide/stays");
    expect(page?.data.title).toBe("1.0.0/guide/stays.md");
  });

  it("keeps a relative link inside the version being browsed", () => {
    // The single most important assertion here. A single loader means a single storage, and
    // `resolveHref` keys on the rewritten virtual path — so `./b.md` from a page inherited into
    // 3.0.0 resolves to 3.0.0's copy, not to 1.0.0's.
    const { source } = build();
    const page = source.getPage(["3.0.0", "guide", "intro"]);

    expect(page).toBeDefined();
    if (page === undefined) return;
    expect(source.resolveHref("./b.md", page)).toBe("/docs/3.0.0/guide/b");
  });

  it("leaves a relative link alone when the extension does not match a real file", () => {
    // `resolveHref` looks the virtual path up exactly, so `./b.mdx` never finds `b.md`.
    const { source } = build();
    const page = source.getPage(["3.0.0", "guide", "intro"]);

    expect(page).toBeDefined();
    if (page === undefined) return;
    expect(source.resolveHref("./b.mdx", page)).toBe("./b.mdx");
  });

  it("resolves a relative link from within the oldest version too", () => {
    const { source } = build();
    const page = source.getPage(["1.0.0", "guide", "intro"]);

    expect(page).toBeDefined();
    if (page === undefined) return;
    expect(source.resolveHref("./b.md", page)).toBe("/docs/1.0.0/guide/b");
  });

  it("finds a page by its generated URL", () => {
    const { source } = build();
    expect(source.getPageByHref("/docs/2.0.0/guide/intro")?.page.url).toBe("/docs/2.0.0/guide/intro");
  });

  it("maps a version index file onto the bare version URL", () => {
    const { source } = build();
    expect(source.getPage(["1.0.0"])?.url).toBe("/docs/1.0.0");
  });

  it("covers every version in one generateParams call, with no duplicate slug", () => {
    // slugsPlugin throws `Duplicated slugs` on a collision, so a clean build proves the version
    // prefix is doing its job.
    const { source } = build();
    const params = source.generateParams();
    const keys = params.map(entry => entry.slug.join("/"));

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("1.0.0/guide/intro");
    expect(keys).toContain("3.0.0/guide/intro");
    expect(keys).toContain("next/api/new");
  });

  it("lists an inherited page once per version, sharing one data object", () => {
    const { source } = build();
    const stays = source.getPages().filter(page => page.slugs.at(-1) === "stays");

    expect(stays.map(page => page.slugs[0])).toEqual(["1.0.0", "2.0.0", "3.0.0", "next"]);
    expect(new Set(stays.map(page => page.data)).size).toBe(1);
  });

  it("does not serve a tombstoned page", () => {
    const withTombstone = fakeStaticSource(
      fumadocsPage("1.0.0/gone.md"),
      fumadocsPage("2.0.0/kept.md"),
      fumadocsPage("3.0.0/gone.md", { overlay: { deleted: true } })
    );
    const { source } = build({ source: withTombstone });

    expect(source.getPage(["2.0.0", "gone"])).toBeDefined();
    expect(source.getPage(["3.0.0", "gone"])).toBeUndefined();
  });

  it("keeps absolutePath on the defining file while path follows the version", () => {
    const { source } = build();
    const page = source.getPage(["3.0.0", "guide", "stays"]);

    expect(page?.path).toBe("3.0.0/guide/stays.md");
    expect(page?.absolutePath).toBe("content/docs/1.0.0/guide/stays.md");
  });
});

describe("latestAtRoot", () => {
  it("serves the newest release at the base URL and older ones under their segment", () => {
    // Same URL shape as the Docusaurus site being migrated, so no existing link breaks.
    const { source, overlay } = build({ latestAtRoot: true });

    expect(overlay.latest?.id).toBe("3.0.0");
    expect(source.getPage(["3.0.0", "guide", "stays"])?.url).toBe("/docs/guide/stays");
    expect(source.getPage(["1.0.0", "guide", "stays"])?.url).toBe("/docs/1.0.0/guide/stays");
    expect(source.getPage(["next", "guide", "stays"])?.url).toBe("/docs/next/guide/stays");
  });

  it("keeps the version in the slugs, so generateParams still distinguishes versions", () => {
    const { source } = build({ latestAtRoot: true });
    const keys = source.generateParams().map(entry => entry.slug.join("/"));

    expect(keys).toContain("3.0.0/guide/stays");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("maps the latest version's index onto the base URL itself", () => {
    const { source } = build({ latestAtRoot: true });
    expect(source.getPage(["3.0.0"])?.url).toBe("/docs");
  });
});

describe("version metadata", () => {
  it("reports segments, labels and landing URLs", () => {
    const { overlay } = build({ labels: { next: "Next 🚧" } });

    expect(overlay.versions.map(version => [version.id, version.label, version.url])).toEqual([
      ["1.0.0", "1.0.0", "/docs/1.0.0"],
      ["2.0.0", "2.0.0", "/docs/2.0.0"],
      ["3.0.0", "3.0.0", "/docs/3.0.0"],
      ["next", "Next 🚧", "/docs/next"]
    ]);
  });

  it("takes a label from the opaque version meta when no override is given", () => {
    const { overlay } = build({ versions: { "1.0.0": { meta: { label: "1.0 (LTS)" } } } });
    expect(overlay.versionOf("1.0.0")?.label).toBe("1.0 (LTS)");
  });

  it("marks the latest release and the channels", () => {
    const { overlay } = build();

    expect(overlay.versions.filter(version => version.isLatest).map(version => version.id)).toEqual(["3.0.0"]);
    expect(overlay.versions.filter(version => version.isChannel).map(version => version.id)).toEqual(["next"]);
  });

  it("looks a version up by id or by segment", () => {
    const { overlay } = build({ versionSegment: version => (version.channel === undefined ? version.id : "unreleased") });

    expect(overlay.versionOf("next")?.segment).toBe("unreleased");
    expect(overlay.versionOfSegment("unreleased")?.id).toBe("next");
    expect(overlay.versionOfSegment("nope")).toBeUndefined();
  });

  it("surfaces diagnostics instead of throwing", () => {
    const { overlay } = build({ source: fakeStaticSource(fumadocsPage("1.0.0/a.md"), fumadocsPage("draft/a.md")) });
    expect(overlay.diagnostics.map(entry => entry.code)).toContain("unknown-version-folder");
  });
});
