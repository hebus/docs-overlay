import { describe, expect, it } from "vitest";

import { overlaySource } from "./overlay-source.js";
import { staticParams } from "./params.js";
import { joinUrl } from "./paths.js";
import { resolveRoute, switchVersion } from "./route.js";
import { fakeStaticSource, fumadocsPage } from "./testing/fake-source.js";

/**
 * Documentation served from the site root, which is what Docusaurus calls `routeBasePath: '/'`.
 *
 * The pages are grouped by product inside each version rather than by scope, so `11.14.0` at the
 * root answers `/mint/features/preview` and `11.13.0` answers `/11.13.0/mint/features/preview` —
 * the URL shape a Docusaurus site with `lastVersion` already publishes, and the one a migration is
 * not allowed to change.
 */
const content = fakeStaticSource(
  fumadocsPage("11.13.0/index.md"),
  fumadocsPage("11.13.0/changelog.md"),
  fumadocsPage("11.13.0/mint/features/preview.md"),
  fumadocsPage("11.13.0/mint/configurations/routes.md"),
  fumadocsPage("11.13.0/atomic/intro.md"),
  fumadocsPage("11.14.0/mint/configurations/customization/routes.md", {
    overlay: { renamedFrom: "mint/configurations/routes" }
  }),
  fumadocsPage("next/.gitkeep.md")
);

const site = () => overlaySource({ source: content, baseUrl: "/", channels: ["next"], latestAtRoot: true });

describe("joinUrl", () => {
  it("does not double the separator a root base URL already carries", () => {
    // `//mint/features/preview` is not a path — a browser reads it as protocol-relative and leaves
    // the site for a host called `mint`.
    expect(joinUrl("/", "mint", "features", "preview")).toBe("/mint/features/preview");
    expect(joinUrl("/")).toBe("/");
  });

  it("leaves a nested base URL alone", () => {
    expect(joinUrl("/docs", "1.0.0", "guide")).toBe("/docs/1.0.0/guide");
    expect(joinUrl("/docs")).toBe("/docs");
  });

  it("ignores empty segments rather than emitting a bare separator for them", () => {
    expect(joinUrl("/docs", "", "guide")).toBe("/docs/guide");
    expect(joinUrl("/", "")).toBe("/");
  });
});

describe("a base URL given with a trailing slash", () => {
  /**
   * `joinUrl` takes a normalised base URL and does not defend the precondition itself, so what keeps
   * a `"/docs/"` from reaching it is `normaliseBaseUrl`. That function is internal, so this asserts
   * it through the only thing a consumer can see — the URLs that come out.
   */
  it("is normalised before any URL is built from it", () => {
    const source = overlaySource({ source: content, baseUrl: "/docs/", channels: ["next"], latestAtRoot: true });

    expect(source.baseUrl).toBe("/docs");
    expect(source.url(["11.14.0", "mint", "features", "preview"])).toBe("/docs/mint/features/preview");
    expect(source.url(["11.13.0", "mint", "features", "preview"])).toBe("/docs/11.13.0/mint/features/preview");
    expect(Object.fromEntries(source.versions.map(info => [info.id, info.url]))).toEqual({
      "11.13.0": "/docs/11.13.0",
      "11.14.0": "/docs",
      next: "/docs/next"
    });
  });
});

describe("a source served from the site root", () => {
  it("gives the root version no segment and the others one", () => {
    const urls = Object.fromEntries(site().versions.map(info => [info.id, info.url]));

    expect(urls).toEqual({ "11.13.0": "/11.13.0", "11.14.0": "/", next: "/next" });
  });

  it("builds page URLs without a leading double separator", () => {
    const source = site();

    expect(source.url(["11.14.0", "mint", "features", "preview"])).toBe("/mint/features/preview");
    expect(source.url(["11.13.0", "mint", "features", "preview"])).toBe("/11.13.0/mint/features/preview");
    expect(source.url(["next", "atomic", "intro"])).toBe("/next/atomic/intro");
    expect(source.url(["11.14.0"])).toBe("/");
  });

  it("redirects a renamed slug to a URL that stays on the site", () => {
    const route = resolveRoute(site(), ["mint", "configurations", "routes"]);

    expect(route).toEqual({
      kind: "redirect",
      to: "/mint/configurations/customization/routes",
      permanent: true
    });
  });

  it("falls back to the version landing page when a page does not exist there", () => {
    // `customization/routes` is 11.14.0's; switching to 11.13.0 has nowhere exact to land.
    expect(switchVersion(site(), ["mint", "configurations", "customization", "routes"], "11.13.0")).toEqual({
      slugs: ["11.13.0"],
      url: "/11.13.0",
      exact: false
    });
  });

  it("routes every slug it generates params for", () => {
    const source = site();

    for (const { slug } of staticParams(source)) {
      expect(resolveRoute(source, slug).kind).not.toBe("not-found");
    }
  });
});
