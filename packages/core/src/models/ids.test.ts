import { describe, expect, it } from "vitest";

import { parseSlugKey, slugKey, splitVersionSegment, toSlug, toSlugKey, withVersionSegment } from "./ids.js";

describe("slug keys", () => {
  it("round-trips", () => {
    expect(slugKey(["guide", "api"])).toBe("guide/api");
    expect(parseSlugKey("guide/api")).toEqual(["guide", "api"]);
  });

  it("represents the version landing page as an empty slug", () => {
    expect(slugKey([])).toBe("");
    expect(parseSlugKey("")).toEqual([]);
  });

  it("accepts either representation", () => {
    expect(toSlug("guide/api")).toEqual(["guide", "api"]);
    expect(toSlug(["guide", "api"])).toEqual(["guide", "api"]);
    expect(toSlugKey("guide/api")).toBe("guide/api");
    expect(toSlugKey(["guide", "api"])).toBe("guide/api");
  });
});

describe("version segment", () => {
  it("splits off the leading version", () => {
    expect(splitVersionSegment("11.14.0/guide/api.mdx")).toEqual({ version: "11.14.0", rest: "guide/api.mdx" });
  });

  it("handles a file sitting at the version root", () => {
    expect(splitVersionSegment("11.14.0/index.mdx")).toEqual({ version: "11.14.0", rest: "index.mdx" });
    expect(splitVersionSegment("11.14.0")).toEqual({ version: "11.14.0", rest: "" });
  });

  it("tolerates a leading slash", () => {
    expect(splitVersionSegment("/11.14.0/a.md")).toEqual({ version: "11.14.0", rest: "a.md" });
  });

  it("rewrites a path into another version's space", () => {
    // This is what keeps relative links inside the version a reader is browsing.
    expect(withVersionSegment("1.0.0/guide/api.mdx", "3.0.0")).toBe("3.0.0/guide/api.mdx");
    expect(withVersionSegment("1.0.0", "3.0.0")).toBe("3.0.0");
  });
});
