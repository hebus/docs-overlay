import { describe, expect, it } from "vitest";

import { searchTagsOf } from "./diagnostics.js";
import { overlaySource } from "./overlay-source.js";
import { staticParams } from "./params.js";
import { resolveRoute, switchVersion } from "./route.js";
import { fakeStaticSource, fumadocsPage } from "./testing/fake-source.js";

/**
 * Two documentations on one site, each with its own versions — the shape of a monorepo publishing
 * several packages, where `2.0.0` of one has nothing to do with `2.0.0` of the other.
 *
 * `guide/shared.md` exists in both on purpose: it is the collision the single loader would suffer if
 * the scope did not reach paths and slugs.
 */
const content = fakeStaticSource(
  fumadocsPage("alpha/1.0.0/index.md"),
  fumadocsPage("alpha/1.0.0/guide/shared.md"),
  fumadocsPage("alpha/1.0.0/guide/only-alpha.md"),
  fumadocsPage("alpha/2.0.0/guide/shared.md"),
  fumadocsPage("alpha/2.0.0/guide/added.md"),
  fumadocsPage("beta/1.0.0/index.md"),
  fumadocsPage("beta/1.0.0/guide/shared.md")
);

const alpha = () => overlaySource({ source: content, scope: "alpha", channels: ["next"] });
const beta = () => overlaySource({ source: content, scope: "beta", channels: ["next"] });

describe("a scoped source", () => {
  it("sees only its own documentation", () => {
    // `beta/` is invisible to alpha, so `beta` is not mistaken for one of its version folders.
    expect(alpha().versions.map(info => info.id)).toEqual(["1.0.0", "2.0.0", "next"]);
    expect(beta().versions.map(info => info.id)).toEqual(["1.0.0", "next"]);
  });

  it("puts the scope in the URL, before the version", () => {
    expect(alpha().versionOf("1.0.0")?.url).toBe("/docs/alpha/1.0.0");
    expect(beta().versionOf("1.0.0")?.url).toBe("/docs/beta/1.0.0");
  });

  it("keeps two documentations from overwriting each other's files", () => {
    // The same slug in both, which is exactly what one file system for two sources would lose.
    const paths = (source: ReturnType<typeof alpha>) => source.source.files.map(file => file.path);

    expect(paths(alpha())).toContain("alpha/1.0.0/guide/shared.md");
    expect(paths(beta())).toContain("beta/1.0.0/guide/shared.md");

    // The version list of one must not land on the other's, either.
    expect(paths(alpha())).toContain("alpha/meta.json");
    expect(paths(beta())).toContain("beta/meta.json");
  });

  it("serves each documentation its own content under the same slug", () => {
    expect(resolveRoute(alpha(), ["alpha", "1.0.0", "guide", "shared"])).toEqual({
      kind: "page",
      version: "1.0.0",
      slugs: ["alpha", "1.0.0", "guide", "shared"]
    });

    expect(resolveRoute(beta(), ["beta", "1.0.0", "guide", "shared"])).toEqual({
      kind: "page",
      version: "1.0.0",
      slugs: ["beta", "1.0.0", "guide", "shared"]
    });
  });

  it("inherits within a documentation and never across", () => {
    // `only-alpha` is 1.0.0's file, inherited into alpha 2.0.0…
    expect(resolveRoute(alpha(), ["alpha", "2.0.0", "guide", "only-alpha"])).toEqual({
      kind: "page",
      version: "2.0.0",
      slugs: ["alpha", "2.0.0", "guide", "only-alpha"],
      inheritedFrom: { version: "1.0.0", hops: 1 }
    });

    // …and unknown to beta, whose own 1.0.0 never had it.
    expect(resolveRoute(beta(), ["beta", "1.0.0", "guide", "only-alpha"])).toEqual({ kind: "not-found" });
  });

  it("refuses another scope instead of hunting for it in its own root version", () => {
    // Without this, `beta/guide/shared` would be looked up as a page of alpha's root version and
    // answer a plain 404 — right code, wrong reason, and no way to tell the two apart.
    expect(resolveRoute(alpha(), ["beta", "1.0.0", "guide", "shared"])).toEqual({ kind: "not-found" });
    expect(resolveRoute(alpha(), ["nobody", "guide", "shared"])).toEqual({ kind: "not-found" });
    expect(resolveRoute(alpha(), [])).toEqual({ kind: "not-found" });
  });

  it("keeps latestAtRoot dropping the version segment, but never the scope", () => {
    const source = overlaySource({ source: content, scope: "alpha", channels: ["next"], latestAtRoot: true });

    expect(source.versionOf("2.0.0")?.url).toBe("/docs/alpha");
    expect(source.url(["alpha", "2.0.0", "guide", "shared"])).toBe("/docs/alpha/guide/shared");
    expect(source.url(["alpha", "1.0.0", "guide", "shared"])).toBe("/docs/alpha/1.0.0/guide/shared");

    // A segment-less request is the root version of *this* documentation.
    expect(resolveRoute(source, ["alpha", "guide", "shared"])).toEqual({
      kind: "page",
      version: "2.0.0",
      slugs: ["alpha", "2.0.0", "guide", "shared"]
    });
  });

  it("generates params that carry the scope", () => {
    const params = staticParams(alpha());

    expect(params).toContainEqual({ slug: ["alpha", "1.0.0", "guide", "shared"] });
    expect(params.every(entry => entry.slug[0] === "alpha")).toBe(true);
  });

  it("switches version inside its own documentation", () => {
    expect(switchVersion(alpha(), ["alpha", "2.0.0", "guide", "shared"], "1.0.0")).toEqual({
      slugs: ["alpha", "1.0.0", "guide", "shared"],
      url: "/docs/alpha/1.0.0/guide/shared",
      exact: true
    });

    // A page added in 2.0.0 does not exist in 1.0.0 — inheritance only ever goes forward — so the
    // reader lands on that version's landing page and `exact: false` lets the UI say why.
    expect(switchVersion(alpha(), ["alpha", "2.0.0", "guide", "added"], "1.0.0")).toEqual({
      slugs: ["alpha", "1.0.0"],
      url: "/docs/alpha/1.0.0",
      exact: false
    });
  });

  it("tags a search entry with both the documentation and the version", () => {
    expect(searchTagsOf(alpha(), { slugs: ["alpha", "1.0.0", "guide", "shared"] })).toEqual(["alpha", "1.0.0"]);
    // Unscoped, the version is the first segment and the only tag there is.
    expect(searchTagsOf({ scope: undefined }, { slugs: ["1.0.0", "guide", "shared"] })).toEqual(["1.0.0"]);
  });
});

describe("an unscoped source", () => {
  const flat = fakeStaticSource(fumadocsPage("1.0.0/index.md"), fumadocsPage("1.0.0/guide/a.md"));

  it("behaves as if the scope had never been added", () => {
    const source = overlaySource({ source: flat, channels: ["next"] });

    expect(source.scope).toBeUndefined();
    expect(source.versionOf("1.0.0")?.url).toBe("/docs/1.0.0");
    expect(source.source.files.map(file => file.path)).toContain("1.0.0/guide/a.md");
    expect(resolveRoute(source, ["1.0.0", "guide", "a"])).toEqual({
      kind: "page",
      version: "1.0.0",
      slugs: ["1.0.0", "guide", "a"]
    });
  });

  it("treats an empty scope as none, rather than as a nameless documentation", () => {
    expect(overlaySource({ source: flat, scope: "", channels: ["next"] }).scope).toBeUndefined();
    expect(overlaySource({ source: flat, scope: "/", channels: ["next"] }).scope).toBeUndefined();
  });
});
