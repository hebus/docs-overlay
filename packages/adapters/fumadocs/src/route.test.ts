import { describe, expect, it } from "vitest";

import { overlaySource, type OverlayFumadocsOptions } from "./overlay-source.js";
import { redirectParams, toNetlifyRedirects, toNextRedirects } from "./redirects.js";
import { resolveRoute, switchVersion } from "./route.js";
import { fakeStaticSource, fumadocsPage } from "./testing/fake-source.js";

const content = fakeStaticSource(
  fumadocsPage("1.0.0/index.md"),
  fumadocsPage("1.0.0/guide/intro.md"),
  fumadocsPage("1.0.0/guide/old-api.md"),
  fumadocsPage("1.0.0/guide/legacy.md"),
  fumadocsPage("2.0.0/guide/new-api.md", { overlay: { renamedFrom: "guide/old-api" } }),
  fumadocsPage("3.0.0/guide/modern.md"),
  fumadocsPage("3.0.0/guide/legacy.md", { overlay: { deleted: true, replacedBy: "guide/modern" } }),
  fumadocsPage("3.0.0/api/index.md", { overlay: { aliases: ["api-reference"] } })
);

const build = (options: Partial<OverlayFumadocsOptions> = {}) => overlaySource({ source: content, channels: ["next"], ...options });

describe("resolveRoute", () => {
  it("serves a page under an explicit version segment", () => {
    // `guide/intro` only ever existed in 1.0.0, so 3.0.0 serves it across two hops and says so.
    expect(resolveRoute(build(), ["3.0.0", "guide", "intro"])).toEqual({
      kind: "page",
      version: "3.0.0",
      slugs: ["3.0.0", "guide", "intro"],
      inheritedFrom: { version: "1.0.0", hops: 2 }
    });
  });

  it("says nothing about inheritance when the version owns the file", () => {
    // The absence is the API: a reader on 1.0.0 is reading 1.0.0's own file and needs no notice.
    const result = resolveRoute(build(), ["1.0.0", "guide", "intro"]);

    expect(result.kind).toBe("page");
    expect(result).not.toHaveProperty("inheritedFrom");
  });

  it("counts one hop to the version immediately before", () => {
    expect(resolveRoute(build(), ["3.0.0", "guide", "new-api"])).toEqual({
      kind: "page",
      version: "3.0.0",
      slugs: ["3.0.0", "guide", "new-api"],
      inheritedFrom: { version: "2.0.0", hops: 1 }
    });
  });

  it("reports inheritance through an alias too", () => {
    // The alias is declared in 3.0.0 on 3.0.0's own file, so `next` serves both by inheritance.
    expect(resolveRoute(build(), ["next", "api-reference"])).toEqual({
      kind: "page",
      version: "next",
      slugs: ["next", "api"],
      canonicalUrl: "/docs/next/api",
      inheritedFrom: { version: "3.0.0", hops: 1 }
    });
  });

  it("404s on a version nobody has heard of", () => {
    expect(resolveRoute(build(), ["9.9.9", "guide", "intro"])).toEqual({ kind: "not-found" });
  });

  it("404s on a page the version never had", () => {
    expect(resolveRoute(build(), ["1.0.0", "guide", "modern"])).toEqual({ kind: "not-found" });
  });

  it("redirects an old slug from the renaming version onwards", () => {
    const source = build();

    expect(resolveRoute(source, ["2.0.0", "guide", "old-api"])).toEqual({ kind: "redirect", to: "/docs/2.0.0/guide/new-api", permanent: true });
    // Still a redirect in a later version: an external link that worked must keep working.
    expect(resolveRoute(source, ["3.0.0", "guide", "old-api"])).toEqual({ kind: "redirect", to: "/docs/3.0.0/guide/new-api", permanent: true });
  });

  it("still serves the old slug in the version that predates the rename", () => {
    expect(resolveRoute(build(), ["1.0.0", "guide", "old-api"]).kind).toBe("page");
  });

  it("explains a removal instead of 404ing", () => {
    const result = resolveRoute(build(), ["3.0.0", "guide", "legacy"]);

    expect(result).toEqual({
      kind: "gone",
      version: "3.0.0",
      deletedIn: "3.0.0",
      lastAvailableUrl: "/docs/2.0.0/guide/legacy",
      replacedByUrl: "/docs/3.0.0/guide/modern"
    });
  });

  it("serves an alias with a canonical pointing at the real slug", () => {
    const result = resolveRoute(build(), ["3.0.0", "api-reference"]);

    expect(result).toEqual({ kind: "page", version: "3.0.0", slugs: ["3.0.0", "api"], canonicalUrl: "/docs/3.0.0/api" });
  });

  it("resolves the version landing page", () => {
    expect(resolveRoute(build(), ["1.0.0"])).toEqual({ kind: "page", version: "1.0.0", slugs: ["1.0.0"] });
  });

  it("without latestAtRoot, the bare base URL resolves to nothing", () => {
    expect(resolveRoute(build(), undefined)).toEqual({ kind: "not-found" });
    expect(resolveRoute(build(), [])).toEqual({ kind: "not-found" });
  });
});

describe("resolveRoute with latestAtRoot", () => {
  const source = () => build({ latestAtRoot: true });

  it("treats a segment-less request as the newest release", () => {
    expect(resolveRoute(source(), ["guide", "intro"])).toEqual({
      kind: "page",
      version: "3.0.0",
      slugs: ["3.0.0", "guide", "intro"],
      inheritedFrom: { version: "1.0.0", hops: 2 }
    });
  });

  it("resolves the bare base URL to the newest release's landing page", () => {
    expect(resolveRoute(source(), [])).toEqual({
      kind: "page",
      version: "3.0.0",
      slugs: ["3.0.0"],
      inheritedFrom: { version: "1.0.0", hops: 2 }
    });
  });

  it("still honours an explicit older segment", () => {
    expect(resolveRoute(source(), ["1.0.0", "guide", "intro"])).toEqual({ kind: "page", version: "1.0.0", slugs: ["1.0.0", "guide", "intro"] });
  });

  it("redirects a segment-less old slug within the newest release", () => {
    expect(resolveRoute(source(), ["guide", "old-api"])).toEqual({ kind: "redirect", to: "/docs/guide/new-api", permanent: true });
  });
});

describe("switchVersion", () => {
  it("keeps the current page when the target version has it", () => {
    expect(switchVersion(build(), ["3.0.0", "guide", "intro"], "1.0.0")).toEqual({
      slugs: ["1.0.0", "guide", "intro"],
      url: "/docs/1.0.0/guide/intro",
      exact: true
    });
  });

  it("falls back to the target's landing page and says the match was not exact", () => {
    // Clicking through to a version that never had this page must not land on a 404.
    expect(switchVersion(build(), ["3.0.0", "guide", "modern"], "1.0.0")).toEqual({
      slugs: ["1.0.0"],
      url: "/docs/1.0.0",
      exact: false
    });
  });

  it("maps a landing page onto the other version's landing page, exactly", () => {
    expect(switchVersion(build(), ["3.0.0"], "1.0.0")).toEqual({ slugs: ["1.0.0"], url: "/docs/1.0.0", exact: true });
  });

  it("follows an alias to the real slug", () => {
    expect(switchVersion(build(), ["3.0.0", "api-reference"], "next").slugs).toEqual(["next", "api"]);
  });

  it("lands on the base URL for an unknown target", () => {
    expect(switchVersion(build(), ["3.0.0", "guide", "intro"], "9.9.9")).toEqual({ slugs: [], url: "/docs", exact: false });
  });
});

describe("redirect outputs", () => {
  it("lists rules for a server deployment", () => {
    expect(toNextRedirects(build())).toEqual([
      { source: "/docs/2.0.0/guide/old-api", destination: "/docs/2.0.0/guide/new-api", permanent: true },
      { source: "/docs/3.0.0/guide/old-api", destination: "/docs/3.0.0/guide/new-api", permanent: true },
      { source: "/docs/next/guide/old-api", destination: "/docs/next/guide/new-api", permanent: true }
    ]);
  });

  it("writes a Netlify redirects file", () => {
    expect(toNetlifyRedirects(build()).split("\n")[0]).toBe("/docs/2.0.0/guide/old-api /docs/2.0.0/guide/new-api 301");
  });

  it("adds static params so every old slug gets a real file under output: export", () => {
    expect(redirectParams(build())).toEqual([
      { slug: ["2.0.0", "guide", "old-api"] },
      { slug: ["3.0.0", "guide", "old-api"] },
      { slug: ["next", "guide", "old-api"] }
    ]);
  });

  it("mirrors the URL shape when the newest release sits at the root", () => {
    expect(redirectParams(build({ latestAtRoot: true }))).toEqual([
      { slug: ["2.0.0", "guide", "old-api"] },
      { slug: ["guide", "old-api"] },
      { slug: ["next", "guide", "old-api"] }
    ]);
  });

  it("honours a custom param name", () => {
    expect(redirectParams(build(), "path")[0]).toEqual({ path: ["2.0.0", "guide", "old-api"] });
  });

  it("produces no params when nothing was ever renamed", () => {
    expect(redirectParams(overlaySource({ source: fakeStaticSource(fumadocsPage("1.0.0/a.md")) }))).toEqual([]);
  });
});

describe("the inherited-notice switch", () => {
  it("is on unless a project turns it off", () => {
    expect(build().inheritedNotice).toBe(true);
    expect(build({ inheritedNotice: true }).inheritedNotice).toBe(true);
    expect(build({ inheritedNotice: false }).inheritedNotice).toBe(false);
  });

  it("changes what to show, never what is true", () => {
    // Turning the notice off is a rendering choice. Withholding the fact would leave a consumer
    // unable to make any other choice with it.
    const quiet = build({ inheritedNotice: false });

    expect(resolveRoute(quiet, ["3.0.0", "guide", "intro"])).toEqual({
      kind: "page",
      version: "3.0.0",
      slugs: ["3.0.0", "guide", "intro"],
      inheritedFrom: { version: "1.0.0", hops: 2 }
    });
  });
});

describe("the version served at the root", () => {
  it("is the newest release when there is one", () => {
    const source = build({ latestAtRoot: true });

    expect(source.root?.id).toBe("3.0.0");
    expect(source.latest?.id).toBe("3.0.0");
    expect(source.versionOf("3.0.0")?.isRoot).toBe(true);
    expect(source.versionOf("next")?.isRoot).toBe(false);
  });

  it("falls back to the newest version when nothing has been released", () => {
    // A project whose documentation precedes its first release: `latest` is undefined because the only
    // version is a channel, yet the URLs should still be clean.
    const unreleased = overlaySource({
      source: fakeStaticSource(fumadocsPage("next/index.md"), fumadocsPage("next/guide.md")),
      channels: ["next"],
      latestAtRoot: true
    });

    expect(unreleased.latest).toBeUndefined();
    expect(unreleased.root?.id).toBe("next");
    expect(unreleased.url(["next", "guide"])).toBe("/docs/guide");
    expect(resolveRoute(unreleased, ["guide"])).toEqual({ kind: "page", version: "next", slugs: ["next", "guide"] });
  });

  it("is nobody when latestAtRoot is off", () => {
    const source = build();

    expect(source.root).toBeUndefined();
    expect(source.versions.every(version => !version.isRoot)).toBe(true);
    expect(source.url(["3.0.0", "guide", "intro"])).toBe("/docs/3.0.0/guide/intro");
  });

  it("marks the newest release even when it is not the one at the root", () => {
    const source = build();
    expect(source.versionOf("3.0.0")?.isLatest).toBe(true);
  });
});
