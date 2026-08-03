import { pageSchema } from "fumadocs-core/source/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { overlaySchema, withOverlay } from "./schema.js";

/**
 * Regression guard for the project's nastiest failure mode. `pageSchema` strips unknown keys, so
 * without `withOverlay()` every overlay directive is thrown away and nothing says a word: pages
 * render, routes work, search works, and no page is ever deleted or redirected.
 */
describe("the strip that makes this necessary", () => {
  it("pageSchema really does drop overlay", () => {
    const parsed = pageSchema.parse({ title: "Old API", overlay: { deleted: true } });
    expect(parsed).not.toHaveProperty("overlay");
  });

  it("withOverlay keeps it", () => {
    const parsed = withOverlay(pageSchema).parse({ title: "Old API", overlay: { deleted: true } });
    expect(parsed.overlay).toEqual({ deleted: true });
  });
});

describe("withOverlay", () => {
  it("preserves the fields the original schema already validated", () => {
    const parsed = withOverlay(pageSchema).parse({ title: "Guide", description: "d", overlay: { renamedFrom: "guide/old" } });

    expect(parsed.title).toBe("Guide");
    expect(parsed.description).toBe("d");
    expect(parsed.overlay).toEqual({ renamedFrom: "guide/old" });
  });

  it("still rejects what the original schema rejected", () => {
    expect(() => withOverlay(pageSchema).parse({ overlay: { deleted: true } })).toThrow();
  });

  it("accepts a page with no overlay block at all", () => {
    expect(withOverlay(pageSchema).parse({ title: "Guide" }).overlay).toBeUndefined();
  });

  it("extends any object schema, not just pageSchema", () => {
    const custom = z.object({ heading: z.string() });
    const parsed = withOverlay(custom).parse({ heading: "h", overlay: { aliases: ["short"] } });

    expect(parsed.heading).toBe("h");
    expect(parsed.overlay).toEqual({ aliases: ["short"] });
  });
});

describe("overlaySchema", () => {
  it("accepts every directive", () => {
    const value = { deleted: true, recursive: true, renamedFrom: ["a", "b"], aliases: "c", replacedBy: "d" };
    expect(overlaySchema.parse(value)).toEqual(value);
  });

  it("accepts a bare string where a list is allowed", () => {
    expect(overlaySchema.parse({ renamedFrom: "guide/old" })).toEqual({ renamedFrom: "guide/old" });
  });

  it("rejects nonsense rather than passing it to the resolver", () => {
    expect(() => overlaySchema.parse({ deleted: "yes" })).toThrow();
    expect(() => overlaySchema.parse({ renamedFrom: [""] })).toThrow();
    expect(() => overlaySchema.parse({ replacedBy: 42 })).toThrow();
  });
});
