import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * The guards TypeScript cannot provide.
 *
 * npm hoists every workspace dependency to the root, so a stray `import "react"` here resolves and
 * compiles on this machine and then breaks in a consumer's project. Same for `node:fs`: it typechecks
 * because some sibling package pulled `@types/node` in.
 *
 * And the promise this package makes that nothing else can check at all: the renderer needs no DOM.
 * `lib` is `["ES2022"]`, so `document.querySelector` is already a type error — but that is one line of
 * config away from not being true, and `globalThis.document` was never a type error to begin with.
 * If this ever fails, the fix is not to relax it: a DOM dependency means the package no longer works
 * at build time, which is the only reason it exists instead of `rehype-mermaid`.
 */

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = join(packageRoot, "src");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
};

const FORBIDDEN: readonly { readonly label: string; readonly pattern: RegExp; readonly why: string }[] = [
  { label: "react", pattern: /^react(-dom)?(\/|$)/, why: "this renders a string, not a component tree" },
  { label: "next", pattern: /^next(\/|$)/, why: "framework integration belongs to whoever calls this" },
  { label: "fumadocs", pattern: /^fumadocs(-|\/|$)/, why: "the consumer knows about Fumadocs; this does not" },
  { label: "astro", pattern: /^astro(\/|$)/, why: "framework integration belongs to whoever calls this" },
  { label: "nextra", pattern: /^nextra(\/|$)/, why: "framework integration belongs to whoever calls this" },
  { label: "vitepress", pattern: /^vitepress(\/|$)/, why: "framework integration belongs to whoever calls this" },
  { label: "mermaid", pattern: /^mermaid(\/|$)/, why: "`mermaid` drags in d3, cytoscape, katex and a DOM; only `@mermaid-js/parser` is allowed" },
  { label: "a node builtin", pattern: /^node:/, why: "no filesystem, no process: this must run in a browser too" },
  { label: "a bare node builtin", pattern: /^(fs|path|url|os|crypto|child_process)(\/|$)/, why: "no filesystem, no process" }
];

/** Globals that only exist in a browser. A single one of these makes build-time rendering impossible. */
const DOM_GLOBALS: readonly string[] = [
  "window",
  "document",
  "HTMLElement",
  "SVGElement",
  "customElements",
  "navigator",
  "localStorage",
  "requestAnimationFrame"
];

/** What npm publishes: `files: ["dist"]`, built from `src` minus the tests and the fixtures. */
function shippedFiles(directory: string = sourceRoot): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "testing") continue;
      found.push(...shippedFiles(path));
      continue;
    }
    if (extname(entry.name) !== ".ts" || entry.name.endsWith(".test.ts")) continue;
    found.push(path);
  }
  return found;
}

const files = shippedFiles();
const sources = new Map(files.map(path => [path, readFileSync(path, "utf8")]));

const IMPORT = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

const imports = [...sources.entries()].flatMap(([path, code]) => [...code.matchAll(IMPORT)].map(match => ({ path, specifier: match[1] ?? match[2] ?? "" })));

/** Comments hold prose, and prose says "the document" and "a window into". Only code is evidence. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("the guard itself", () => {
  it("is looking at the files it is meant to look at", () => {
    expect(files.length).toBeGreaterThan(15);
    expect(files).toContain(join(sourceRoot, "index.ts"));
    expect(imports.length).toBeGreaterThan(25);
  });

  it("strips comments before hunting for DOM globals", () => {
    expect(codeOnly("/* a document */ const a = 1;")).not.toContain("document");
    expect(codeOnly("// a window\nconst a = 1;")).not.toContain("window");
    expect(codeOnly("const a = document;")).toContain("document");
  });
});

describe("docs-overlay-mermaid", () => {
  it.each(FORBIDDEN)("never imports $label, because $why", ({ pattern }) => {
    expect(imports.filter(entry => pattern.test(entry.specifier))).toEqual([]);
  });

  it("imports nothing but its own modules and its two declared dependencies", () => {
    const allowed = new Set(["@dagrejs/dagre", "@mermaid-js/parser"]);
    const external = imports.filter(entry => !entry.specifier.startsWith(".") && !allowed.has(entry.specifier));
    expect(external).toEqual([]);
  });

  // `tsc` emits a tree of `.d.ts` that a consumer resolves under `moduleResolution: nodenext`, where a
  // relative import without an extension does not resolve.
  it("gives every relative import a .js extension", () => {
    const bare = imports.filter(entry => entry.specifier.startsWith(".") && !entry.specifier.endsWith(".js"));
    expect(bare).toEqual([]);
  });

  it.each(DOM_GLOBALS)("never touches %s", global => {
    const pattern = new RegExp(`\\b${global}\\b`);
    const offenders = [...sources.entries()].filter(entry => pattern.test(codeOnly(entry[1]))).map(entry => entry[0]);
    expect(offenders).toEqual([]);
  });

  it("declares exactly the two dependencies it uses, and no peers", () => {
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(["@dagrejs/dagre", "@mermaid-js/parser"]);
    expect(manifest.peerDependencies).toBeUndefined();
  });

  // A stray NUL got written into `index.ts` once. git then reports the file as binary, `grep` refuses
  // it, and a diff shows nothing useful — a failure mode worth never debugging twice.
  it("holds no control characters that would make a file binary", () => {
    const offenders = [...sources.entries()].filter(entry => /[\0\v\f]/.test(entry[1])).map(entry => entry[0]);
    expect(offenders).toEqual([]);
  });
});
