import { describe, expect, it } from "vitest";

import { page } from "../testing/fixtures.js";
import { defaultReadDirectives, normaliseDirectives } from "./directives.js";

describe("defaultReadDirectives", () => {
  it("reads the overlay key out of the entry metadata", () => {
    expect(defaultReadDirectives(page("3.0.0/a.md", { overlay: { deleted: true } }))).toEqual({ deleted: true });
  });

  it("returns undefined when nothing is declared", () => {
    expect(defaultReadDirectives(page("3.0.0/a.md"))).toBeUndefined();
    expect(defaultReadDirectives(page("3.0.0/a.md", { overlay: {} }))).toBeUndefined();
  });

  it("survives metadata that is not an object", () => {
    expect(defaultReadDirectives({ path: "3.0.0/a.md", kind: "page", meta: null })).toBeUndefined();
    expect(defaultReadDirectives({ path: "3.0.0/a.md", kind: "page", meta: "nonsense" })).toBeUndefined();
  });
});

describe("normaliseDirectives", () => {
  it("accepts a bare string where a list is expected", () => {
    expect(normaliseDirectives({ renamedFrom: "guide/old" })).toEqual({ renamedFrom: ["guide/old"] });
  });

  it("trims the stray slashes authors write", () => {
    expect(normaliseDirectives({ renamedFrom: ["/guide/old/", "  guide/older  "] })).toEqual({
      renamedFrom: ["guide/old", "guide/older"]
    });
  });

  it("drops unusable entries and collapses an all-empty list", () => {
    expect(normaliseDirectives({ renamedFrom: ["", "/", 42, null] })).toBeUndefined();
    expect(normaliseDirectives({ renamedFrom: ["", "guide/old"] })).toEqual({ renamedFrom: ["guide/old"] });
  });

  it("only treats an explicit true as a flag", () => {
    expect(normaliseDirectives({ deleted: "yes" })).toBeUndefined();
    expect(normaliseDirectives({ deleted: true, recursive: true })).toEqual({ deleted: true, recursive: true });
  });

  it("keeps replacedBy and aliases", () => {
    expect(normaliseDirectives({ replacedBy: "guide/new", aliases: ["api"] })).toEqual({
      replacedBy: "guide/new",
      aliases: ["api"]
    });
  });

  it("omits absent keys rather than setting them to undefined", () => {
    expect(Object.keys(normaliseDirectives({ deleted: true }) ?? {})).toEqual(["deleted"]);
  });

  it("returns undefined for a non-object", () => {
    expect(normaliseDirectives(undefined)).toBeUndefined();
    expect(normaliseDirectives("deleted")).toBeUndefined();
  });
});
