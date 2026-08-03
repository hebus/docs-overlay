import { createOverlay, type Overlay } from "docs-overlay";
import { describe, expect, it } from "vitest";

import { fromFumadocsSource, toFumadocsSource, toFumadocsSourceAll, type FumadocsMeta } from "./reproject.js";
import { fakeStaticSource, fumadocsMeta, fumadocsPage, fumadocsPageWindows, fumadocsPageWithSlugs } from "./testing/fake-source.js";

const overlayOf = (source: ReturnType<typeof fakeStaticSource>, channels?: readonly string[]): Overlay<FumadocsMeta> =>
  createOverlay<FumadocsMeta>({
    source: fromFumadocsSource(source),
    ...(channels === undefined ? {} : { channels })
  });

const pathsOf = (files: readonly { path: string }[]) => files.map(file => file.path).sort();

describe("fromFumadocsSource", () => {
  it("reads the version out of the first path segment", () => {
    const entries = fromFumadocsSource(fakeStaticSource(fumadocsPage("11.14.0/guide/a.md"), fumadocsMeta("11.14.0/meta.json")));

    expect(entries.map(entry => [entry.path, entry.kind])).toEqual([
      ["11.14.0/guide/a.md", "page"],
      ["11.14.0/meta.json", "meta"]
    ]);
  });

  it("passes the compiled data through by reference", () => {
    const file = fumadocsPage("1.0.0/a.md");
    const [entry] = fromFumadocsSource(fakeStaticSource(file));
    expect(entry?.meta).toBe(file.data);
  });

  it("keeps absolutePath as the origin handle", () => {
    const [entry] = fromFumadocsSource(fakeStaticSource(fumadocsPage("1.0.0/a.md")));
    expect(entry?.origin).toBe("content/docs/1.0.0/a.md");
  });

  it("normalises Windows separators, which arrive because absolutePath is built with path.join", () => {
    const [entry] = fromFumadocsSource(fakeStaticSource(fumadocsPageWindows("1.0.0/guide/a.md")));
    expect(entry?.path).toBe("1.0.0/guide/a.md");
    expect(entry?.origin).toBe("content/docs/1.0.0/guide/a.md");
  });

  it("strips a leading baseDir when the source keeps one", () => {
    const source = fakeStaticSource({ ...fumadocsPage("1.0.0/a.md"), path: "content/docs/1.0.0/a.md" });
    const [entry] = fromFumadocsSource(source, { baseDir: "content/docs" });
    expect(entry?.path).toBe("1.0.0/a.md");
  });

  it("drops the version segment from a slug the source already assigned", () => {
    const source = fakeStaticSource(fumadocsPageWithSlugs("1.0.0/a.md", ["1.0.0", "custom", "slug"]));
    const [entry] = fromFumadocsSource(source);
    expect(entry?.slug).toEqual(["custom", "slug"]);
  });

  it("keeps a slug that does not start with the version", () => {
    const source = fakeStaticSource(fumadocsPageWithSlugs("1.0.0/a.md", ["custom"]));
    const [entry] = fromFumadocsSource(source);
    expect(entry?.slug).toEqual(["custom"]);
  });
});

describe("toFumadocsSource", () => {
  const source = fakeStaticSource(
    fumadocsPage("1.0.0/index.md"),
    fumadocsPage("1.0.0/guide/intro.md"),
    fumadocsPage("1.0.0/guide/stays.md"),
    fumadocsMeta("1.0.0/meta.json", { pages: ["guide"] }),
    fumadocsPage("3.0.0/guide/intro.md"),
    fumadocsPage("3.0.0/api/new.md")
  );

  it("emits every page a version serves, inherited ones included", () => {
    const emitted = toFumadocsSource(overlayOf(source), "3.0.0");

    expect(pathsOf(emitted.files.filter(file => file.type === "page"))).toEqual([
      "3.0.0/api/new.md",
      "3.0.0/guide/intro.md",
      "3.0.0/guide/stays.md",
      "3.0.0/index.md"
    ]);
  });

  it("rewrites the path into the browsing version's space", () => {
    // resolveHref() keys on this, so it is what keeps `./b.mdx` inside the version being browsed.
    const emitted = toFumadocsSource(overlayOf(source), "3.0.0");
    const inherited = emitted.files.find(file => file.path === "3.0.0/guide/stays.md");

    expect(inherited).toBeDefined();
    expect(emitted.files.some(file => file.path.startsWith("1.0.0/"))).toBe(false);
  });

  it("keeps absolutePath pointing at the defining file, on purpose", () => {
    // "Edit this page" and last-modified want the real file, not the version being browsed.
    const emitted = toFumadocsSource(overlayOf(source), "3.0.0");
    const inherited = emitted.files.find(file => file.path === "3.0.0/guide/stays.md");

    expect(inherited?.absolutePath).toBe("content/docs/1.0.0/guide/stays.md");
  });

  it("sets slugs explicitly, prefixed with the version segment", () => {
    const emitted = toFumadocsSource(overlayOf(source), "3.0.0");
    const page = emitted.files.find(file => file.path === "3.0.0/guide/stays.md");

    expect(page?.type).toBe("page");
    if (page?.type !== "page") return;
    expect(page.slugs).toEqual(["3.0.0", "guide", "stays"]);
  });

  it("maps an index file onto its folder, and the version root onto the bare segment", () => {
    const emitted = toFumadocsSource(overlayOf(source), "1.0.0");
    const slugs = emitted.files.filter(file => file.type === "page").map(file => (file.type === "page" ? file.slugs : undefined));

    expect(slugs).toContainEqual(["1.0.0"]);
  });

  it("shares the data object rather than cloning it", () => {
    // One chunk for a page served by several versions; cloning would multiply it.
    const overlay = overlayOf(source);
    const base = toFumadocsSource(overlay, "1.0.0").files.find(file => file.path === "1.0.0/guide/stays.md");
    const inherited = toFumadocsSource(overlay, "3.0.0").files.find(file => file.path === "3.0.0/guide/stays.md");

    expect(inherited?.data).toBe(base?.data);
  });

  it("emits inherited metadata files, re-segmented", () => {
    const emitted = toFumadocsSource(overlayOf(source), "3.0.0");
    const meta = emitted.files.find(file => file.type === "meta");

    expect(meta?.path).toBe("3.0.0/meta.json");
    expect(meta?.absolutePath).toBe("content/docs/1.0.0/meta.json");
  });

  it("honours a custom version segment", () => {
    const overlay = overlayOf(source, ["next"]);
    const emitted = toFumadocsSource(overlay, "next", { versionSegment: version => (version.channel === undefined ? version.id : "unreleased") });

    expect(emitted.files.every(file => file.path.startsWith("unreleased/"))).toBe(true);
  });

  it("appends extra files", () => {
    const extra = fumadocsPage("3.0.0/synthetic.md");
    const emitted = toFumadocsSource(overlayOf(source), "3.0.0", { extraFiles: [extra] });

    expect(emitted.files).toContain(extra);
  });

  it("returns only the extras for an unknown version", () => {
    expect(toFumadocsSource(overlayOf(source), "9.9.9").files).toEqual([]);
  });

  it("excludes a tombstoned page", () => {
    const withTombstone = fakeStaticSource(
      fumadocsPage("1.0.0/gone.md"),
      fumadocsPage("2.0.0/kept.md"),
      fumadocsPage("3.0.0/gone.md", { overlay: { deleted: true } })
    );

    const emitted = toFumadocsSource(overlayOf(withTombstone), "3.0.0");
    expect(pathsOf(emitted.files)).toEqual(["3.0.0/kept.md"]);
  });

  it("excludes the old slug of a renamed page", () => {
    const renamed = fakeStaticSource(fumadocsPage("1.0.0/old.md"), fumadocsPage("2.0.0/new.md", { overlay: { renamedFrom: "old" } }));

    const emitted = toFumadocsSource(overlayOf(renamed), "2.0.0");
    expect(pathsOf(emitted.files)).toEqual(["2.0.0/new.md"]);
  });
});

describe("toFumadocsSourceAll", () => {
  const source = fakeStaticSource(fumadocsPage("1.0.0/a.md"), fumadocsPage("2.0.0/b.md"));

  it("puts every version in one source, which is what a single loader consumes", () => {
    const emitted = toFumadocsSourceAll(overlayOf(source));

    expect(pathsOf(emitted.files)).toEqual(["1.0.0/a.md", "2.0.0/a.md", "2.0.0/b.md"]);
  });

  it("produces no duplicate slug, so slugsPlugin never throws", () => {
    const emitted = toFumadocsSourceAll(overlayOf(source, ["next"]));
    const keys = emitted.files.filter(file => file.type === "page").map(file => (file.type === "page" ? file.slugs?.join("/") : undefined));

    expect(new Set(keys).size).toBe(keys.length);
  });
});
