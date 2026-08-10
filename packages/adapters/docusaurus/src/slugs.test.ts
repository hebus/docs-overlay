import { describe, expect, it } from "vitest";

import { docIdOf, docusaurusSlugify } from "./slugs.js";

const slug = docusaurusSlugify();

describe("doc ids", () => {
  it("keeps index, unlike a slug", () => {
    expect(docIdOf("atomic/index.md")).toBe("atomic/index");
  });

  it("strips a number prefix from the file name and from every directory", () => {
    // What Docusaurus does, and what a sidebar therefore names. Getting this wrong makes an authored
    // reference to the page look like a reference to a doc that does not exist, so pruneMissing() drops it.
    expect(docIdOf("mint/tutorial/040_filters.md")).toBe("mint/tutorial/filters");
    expect(docIdOf("010_guides/020_deep/030_page.md")).toBe("guides/deep/page");
  });

  it("accepts the separators Docusaurus accepts, with or without spaces", () => {
    expect(docIdOf("0-a.md")).toBe("a");
    expect(docIdOf("003 - b.md")).toBe("b");
    expect(docIdOf("10_c.md")).toBe("c");
    expect(docIdOf("2.d.md")).toBe("d");
  });

  it("refuses to strip what is really a version or a date", () => {
    // The plugin's own carve-out: both look like a number and a separator, and stripping would remove the
    // part that identifies the page.
    expect(docIdOf("7.0-notes.md")).toBe("7.0-notes");
    expect(docIdOf("2021-11-release.md")).toBe("2021-11-release");
  });

  it("leaves a bare number alone, having no suffix to keep", () => {
    expect(docIdOf("42.md")).toBe("42");
  });

  it("lets the frontmatter id replace the file name, and only the file name", () => {
    // The plugin joins a declared id onto the directory prefix rather than using it whole.
    expect(docIdOf("010_guides/040_filters.md", {}, "chosen")).toBe("guides/chosen");
  });

  it("can be told not to parse prefixes, as the plugin can", () => {
    expect(docIdOf("mint/tutorial/040_filters.md", { parseNumberPrefixes: false })).toBe("mint/tutorial/040_filters");
  });

  it("still accepts the extensions array positionally", () => {
    expect(docIdOf("a/b.markdown", [".markdown"])).toBe("a/b");
  });
});

describe("slugs", () => {
  it("gives index, README and a file named after its folder the folder's URL", () => {
    expect(slug("atomic/index.md")).toEqual(["atomic"]);
    expect(slug("atomic/README.md")).toEqual(["atomic"]);
    expect(slug("atomic/atomic.md")).toEqual(["atomic"]);
  });

  it("strips number prefixes from what it emits", () => {
    expect(slug("mint/tutorial/040_filters.md")).toEqual(["mint", "tutorial", "filters"]);
    expect(slug("010_guides/020_deep/030_page.md")).toEqual(["guides", "deep", "page"]);
  });

  it("compares raw names for the category-index test, then emits stripped ones", () => {
    // `isCategoryIndex` matches `path.parse(source).name` against the unstripped directory, so these two
    // differ — and both are served under the stripped folder name.
    expect(slug("020_guide/020_guide.md")).toEqual(["guide"]);
    expect(slug("020_guide/guide.md")).toEqual(["guide", "guide"]);
  });

  it("does not treat a version or a date as a prefix", () => {
    expect(slug("notes/7.0-notes.md")).toEqual(["notes", "7.0-notes"]);
  });
});
