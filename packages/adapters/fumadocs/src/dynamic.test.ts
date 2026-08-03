import { describe, expect, it } from "vitest";

import { overlayDynamicSource } from "./dynamic.js";
import { fakeStaticSource, fumadocsPage } from "./testing/fake-source.js";

/** A source whose files change between reads, standing in for a watcher. */
function mutable(initial: readonly ReturnType<typeof fumadocsPage>[]) {
  let files = [...initial];
  let reads = 0;
  return {
    read: () => {
      reads += 1;
      return fakeStaticSource(...files);
    },
    set: (next: readonly ReturnType<typeof fumadocsPage>[]) => {
      files = [...next];
    },
    get reads() {
      return reads;
    }
  };
}

describe("overlayDynamicSource", () => {
  it("exposes the current projection through a dynamic source", () => {
    const content = mutable([fumadocsPage("1.0.0/a.md")]);
    const dynamic = overlayDynamicSource({ source: content.read });

    expect(dynamic.source.files()).toHaveLength(dynamic.current.source.files.length);
    expect(dynamic.current.versions.map(version => version.id)).toEqual(["1.0.0"]);
  });

  it("picks up an edited file and reports which versions went stale", () => {
    const content = mutable([fumadocsPage("1.0.0/a.md"), fumadocsPage("2.0.0/b.md"), fumadocsPage("3.0.0/c.md")]);
    const dynamic = overlayDynamicSource({ source: content.read });

    content.set([fumadocsPage("1.0.0/a.md", { title: "edited" }), fumadocsPage("2.0.0/b.md"), fumadocsPage("3.0.0/c.md")]);
    const impact = dynamic.invalidate(["1.0.0/a.md"]);

    expect([...impact.versions].sort()).toEqual(["1.0.0", "2.0.0", "3.0.0"]);
    expect(impact.structural).toBe(false);
    expect(dynamic.current.overlay.getPage("3.0.0", "a")?.meta.title).toBe("edited");
  });

  it("does not report a version the change cannot reach", () => {
    const content = mutable([fumadocsPage("1.0.0/a.md"), fumadocsPage("2.0.0/b.md")]);
    const dynamic = overlayDynamicSource({ source: content.read });

    content.set([fumadocsPage("1.0.0/a.md"), fumadocsPage("2.0.0/b.md", { title: "edited" })]);
    expect(dynamic.invalidate(["2.0.0/b.md"]).versions).toEqual(["2.0.0"]);
  });

  it("flags a new version folder as structural", () => {
    const content = mutable([fumadocsPage("1.0.0/a.md")]);
    const dynamic = overlayDynamicSource({ source: content.read });

    content.set([fumadocsPage("1.0.0/a.md"), fumadocsPage("2.0.0/b.md")]);
    const impact = dynamic.invalidate(["2.0.0/b.md"]);

    expect(impact.structural).toBe(true);
    expect(dynamic.current.versions.map(version => version.id)).toEqual(["1.0.0", "2.0.0"]);
  });

  it("reports a removed page before the state that knew about it is thrown away", () => {
    const content = mutable([fumadocsPage("1.0.0/a.md"), fumadocsPage("2.0.0/b.md")]);
    const dynamic = overlayDynamicSource({ source: content.read });

    content.set([fumadocsPage("2.0.0/b.md")]);
    const impact = dynamic.invalidate(["1.0.0/a.md"]);

    expect([...impact.versions].sort()).toEqual(["1.0.0", "2.0.0"]);
    expect(dynamic.current.overlay.resolve("2.0.0", "a").kind).toBe("missing");
  });

  it("re-reads the source only when invalidated", () => {
    const content = mutable([fumadocsPage("1.0.0/a.md")]);
    const dynamic = overlayDynamicSource({ source: content.read });

    dynamic.source.files();
    dynamic.source.files();
    expect(content.reads).toBe(1);

    dynamic.invalidate(["1.0.0/a.md"]);
    expect(content.reads).toBeGreaterThan(1);
  });
});
