import { describe, expect, it } from "vitest";

import * as adapter from "./index.js";

describe("public entrypoint", () => {
  it("exposes the reprojection surface", () => {
    expect(typeof adapter.fromFumadocsSource).toBe("function");
    expect(typeof adapter.toFumadocsSource).toBe("function");
    expect(typeof adapter.toFumadocsSourceAll).toBe("function");
  });

  it("exposes the path helpers a route needs", () => {
    expect(adapter.versionOfSlugs(["3.0.0", "guide", "a"])).toBe("3.0.0");
    expect(adapter.stripVersion(["3.0.0", "guide", "a"])).toEqual(["guide", "a"]);
    expect(adapter.versionOfSlugs(undefined)).toBeUndefined();
    expect(adapter.versionOfSlugs([])).toBeUndefined();
  });
});
