import { describe, expect, it } from "vitest";

import * as core from "./index.js";

describe("public entrypoint", () => {
  it("exposes the version-ordering surface", () => {
    expect(typeof core.orderVersions).toBe("function");
    expect(typeof core.latestVersion).toBe("function");
    expect(typeof core.chainOf).toBe("function");
    expect(typeof core.foldOrder).toBe("function");
    expect(typeof core.descendantsOf).toBe("function");
  });

  it("exposes the slug helpers", () => {
    expect(core.slugKey(["guide", "api"])).toBe("guide/api");
  });
});
