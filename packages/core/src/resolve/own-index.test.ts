import { describe, expect, it } from "vitest";

import type { ContentEntry } from "../source/content-source.js";
import { collectDiagnostics } from "../testing/diagnostics.js";
import { metaFile, page, tombstone, type Meta } from "../testing/fixtures.js";
import { defaultReadDirectives } from "./directives.js";
import { buildOwnIndexes } from "./own-index.js";
import { createSlugify } from "./slugify.js";

const build = (entries: readonly ContentEntry<Meta>[]) => buildOwnIndexes<Meta>(entries, { slugify: createSlugify(), readDirectives: defaultReadDirectives });

describe("buildOwnIndexes", () => {
  it("groups files by the version folder they live in", () => {
    const indexes = build([page("1.0.0/guide/intro.md"), page("1.0.0/api/a.md"), page("3.0.0/guide/intro.md")]);

    expect([...indexes.keys()].sort()).toEqual(["1.0.0", "3.0.0"]);
    expect([...(indexes.get("1.0.0")?.pages.keys() ?? [])].sort()).toEqual(["api/a", "guide/intro"]);
    expect([...(indexes.get("3.0.0")?.pages.keys() ?? [])]).toEqual(["guide/intro"]);
  });

  it("keys pages by slug, with the version segment stripped", () => {
    const indexes = build([page("1.0.0/guide/index.md"), page("1.0.0/index.md")]);
    const pages = indexes.get("1.0.0")?.pages;

    expect([...(pages?.keys() ?? [])].sort()).toEqual(["", "guide"]);
    expect(pages?.get("guide")?.slug).toEqual(["guide"]);
    expect(pages?.get("")?.slug).toEqual([]);
  });

  it("keeps the full path so the file can be located, and the origin handle untouched", () => {
    const own = build([page("1.0.0/guide/intro.md")])
      .get("1.0.0")
      ?.pages.get("guide/intro");

    expect(own?.path).toBe("1.0.0/guide/intro.md");
    expect(own?.version).toBe("1.0.0");
    expect(own?.origin).toBe("/abs/1.0.0/guide/intro.md");
  });

  it("passes metadata through by reference", () => {
    const entry = page("1.0.0/a.md");
    const own = build([entry]).get("1.0.0")?.pages.get("a");
    expect(own?.meta).toBe(entry.meta);
  });

  it("honours an explicit slug from the source", () => {
    const indexes = build([{ ...page("1.0.0/weird-name.md"), slug: ["guide", "nice"] }]);
    expect([...(indexes.get("1.0.0")?.pages.keys() ?? [])]).toEqual(["guide/nice"]);
  });

  it("indexes meta files by the directory they govern", () => {
    const indexes = build([metaFile("1.0.0/meta.json"), metaFile("1.0.0/guide/meta.json")]);
    expect([...(indexes.get("1.0.0")?.metas.keys() ?? [])].sort()).toEqual(["", "guide"]);
  });

  it("extracts overlay directives", () => {
    const own = build([tombstone("3.0.0/guide/legacy.md", { replacedBy: "guide/new" })])
      .get("3.0.0")
      ?.pages.get("guide/legacy");
    expect(own?.directives).toEqual({ deleted: true, replacedBy: "guide/new" });
  });

  it("gives directive-free pages a shared empty object rather than undefined", () => {
    const indexes = build([page("1.0.0/a.md"), page("1.0.0/b.md")]);
    const a = indexes.get("1.0.0")?.pages.get("a")?.directives;
    expect(a).toEqual({});
    expect(indexes.get("1.0.0")?.pages.get("b")?.directives).toBe(a);
  });

  it("reports a slug collision and keeps the first file", () => {
    const diagnostics = collectDiagnostics();
    const indexes = buildOwnIndexes<Meta>([page("1.0.0/guide/index.md"), page("1.0.0/guide.md")], {
      slugify: createSlugify(),
      readDirectives: defaultReadDirectives,
      onDiagnostic: diagnostics.sink
    });

    expect(diagnostics.codes()).toEqual(["duplicate-slug"]);
    expect(indexes.get("1.0.0")?.pages.get("guide")?.path).toBe("1.0.0/guide/index.md");
  });

  it("ignores a file sitting directly at the content root", () => {
    // No version segment means it belongs to no version.
    expect(build([page("stray.md")]).size).toBe(0);
  });

  it("registers a version folder that only carries meta files", () => {
    const indexes = build([metaFile("3.0.0/meta.json")]);
    expect(indexes.get("3.0.0")?.pages.size).toBe(0);
    expect(indexes.get("3.0.0")?.metas.size).toBe(1);
  });
});
