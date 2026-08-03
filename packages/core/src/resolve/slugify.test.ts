import { describe, expect, it } from "vitest";

import { createSlugify, dirOf } from "./slugify.js";

const slugify = createSlugify();

describe("createSlugify", () => {
  it("drops the page extension", () => {
    expect(slugify("guide/api.mdx")).toEqual(["guide", "api"]);
    expect(slugify("guide/api.md")).toEqual(["guide", "api"]);
  });

  it("maps index files onto their folder", () => {
    expect(slugify("guide/index.mdx")).toEqual(["guide"]);
    expect(slugify("index.mdx")).toEqual([]);
  });

  it("is case-insensitive about the extension", () => {
    expect(slugify("guide/API.MDX")).toEqual(["guide", "API"]);
  });

  it("keeps the name when the extension is not a declared page extension", () => {
    // Truncating at the last dot would silently mangle a deliberate `v1.2` page name.
    expect(slugify("api/v1.2.mdx")).toEqual(["api", "v1.2"]);
    expect(slugify("data/table.json")).toEqual(["data", "table.json"]);
  });

  it("honours a custom extension list", () => {
    expect(createSlugify([".mdoc"])("guide/api.mdoc")).toEqual(["guide", "api"]);
  });

  it("ignores empty segments", () => {
    expect(slugify("/guide//api.mdx")).toEqual(["guide", "api"]);
    expect(slugify("")).toEqual([]);
  });
});

describe("dirOf", () => {
  it("returns the containing directory", () => {
    expect(dirOf("guide/api.mdx")).toBe("guide");
    expect(dirOf("a/b/c.mdx")).toBe("a/b");
  });

  it("returns the empty string at the version root", () => {
    expect(dirOf("meta.json")).toBe("");
  });
});
