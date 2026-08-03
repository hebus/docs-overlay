import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The one architectural rule of this repository, made executable.
 *
 * `@docs-overlay/core` must stay usable anywhere — a browser, a worker, an edge runtime — and must
 * never learn about a documentation framework. A rule that only lives in a README gets broken; this
 * suite fails the build instead.
 *
 * It sits outside `src/` on purpose: it needs `node:fs`, which is exactly what it forbids there.
 */
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = join(packageRoot, "src");

const FORBIDDEN = [
  { label: "react", pattern: /^react(\/|$)/, why: "React is a rendering concern; it belongs in an adapter." },
  { label: "react-dom", pattern: /^react-dom(\/|$)/, why: "React is a rendering concern; it belongs in an adapter." },
  { label: "next", pattern: /^next(\/|$)/, why: "Next.js is a framework; it belongs in an adapter." },
  { label: "fumadocs-*", pattern: /^fumadocs(-|\/|$)/, why: "Fumadocs is a framework; it belongs in @docs-overlay/fumadocs." },
  { label: "astro", pattern: /^astro(\/|$)/, why: "Astro is a framework; it belongs in an adapter." },
  { label: "nextra", pattern: /^nextra(\/|$)/, why: "Nextra is a framework; it belongs in an adapter." },
  { label: "vitepress", pattern: /^vitepress(\/|$)/, why: "VitePress is a framework; it belongs in an adapter." },
  { label: "node: builtins", pattern: /^node:/, why: "Node built-ins break browser and edge runtimes; do the I/O in the caller." },
  { label: "bare node builtins", pattern: /^(fs|path|url|os|crypto|child_process)(\/|$)/, why: "Node built-ins break browser and edge runtimes." }
];

const IMPORT = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;

interface Import {
  readonly file: string;
  readonly specifier: string;
}

function shippedFiles(dir: string, relative = ""): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const key = relative === "" ? entry.name : `${relative}/${entry.name}`;

    // Test helpers and suites are excluded from the published build, so they may use anything.
    if (entry.isDirectory()) {
      if (entry.name !== "testing") files.push(...shippedFiles(path, key));
      continue;
    }
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(key);
  }
  return files;
}

function importsOf(files: readonly string[]): Import[] {
  const found: Import[] = [];
  for (const file of files) {
    const content = readFileSync(join(sourceRoot, file), "utf8");
    for (const match of content.matchAll(IMPORT)) {
      const specifier = match[1] ?? match[2];
      if (specifier !== undefined) found.push({ file, specifier });
    }
  }
  return found;
}

describe("@docs-overlay/core stays framework-agnostic", () => {
  const files = shippedFiles(sourceRoot);
  const imports = importsOf(files);

  it("scans the files it is meant to scan", () => {
    // Guards the guard: a broken glob would make every assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain("index.ts");
    expect(files.some(file => file.endsWith(".test.ts"))).toBe(false);
    expect(imports.length).toBeGreaterThan(20);
    expect(imports.some(entry => entry.specifier.startsWith("./") || entry.specifier.startsWith("../"))).toBe(true);
  });

  it("imports nothing but its own modules", () => {
    const offenders = imports
      .filter(entry => !entry.specifier.startsWith("./") && !entry.specifier.startsWith("../"))
      .map(entry => `${entry.file} imports "${entry.specifier}"`);

    expect(offenders).toEqual([]);
  });

  it.each(FORBIDDEN)("never imports $label", ({ pattern, why }) => {
    const offenders = imports.filter(entry => pattern.test(entry.specifier)).map(entry => `${entry.file} imports "${entry.specifier}" — ${why}`);
    expect(offenders).toEqual([]);
  });

  it("declares no runtime dependency", () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
    expect(Object.keys(manifest.peerDependencies ?? {})).toEqual([]);
  });
});
