import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Makes this adapter's two architectural claims executable.
 *
 * TypeScript alone catches neither. npm hoists every workspace dependency, so a stray import of
 * `@docusaurus/utils` or of `node:fs` resolves and compiles perfectly here — and then breaks in a
 * consumer's project, or quietly turns a pure planner into something that touches disk.
 *
 * `node:fs` is used *by this test*, which is exactly what it forbids in the sources — the same
 * arrangement as the core's architecture test, and for the same reason.
 */

const here = fileURLToPath(new URL("../src/", import.meta.url));

const sources = readdirSync(here, { recursive: true, encoding: "utf8" }).filter(
  name => name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("testing")
);

const read = (name: string): string => readFileSync(new URL(name.replace(/\\/g, "/"), new URL("../src/", import.meta.url)), "utf8");

/**
 * Strips template literals before scanning.
 *
 * The stub templates legitimately *emit* MDX that imports `@docusaurus/Redirect` and
 * `@docusaurus/Head` — those imports belong to the generated page and are resolved by the site, not by
 * this package. Scanning raw text flags them, which looks exactly like the violation this test is for,
 * so the distinction has to be made mechanically rather than by eye.
 */
const withoutTemplates = (text: string): string => text.replace(/`(?:[^`\\]|\\.)*`/gs, "``");

const FORBIDDEN = [
  // The adapter plans; the caller writes. Reading or writing here would make it untestable without a
  // filesystem and would put I/O on both sides of the boundary.
  /\bfrom\s+["']node:/,
  /\brequire\(["']node:/,
  // Nothing from Docusaurus, at runtime or in types. The sidebar shape is described structurally so a
  // consumer needs no `@docusaurus/*` package installed in order to typecheck against this one.
  /\bfrom\s+["']@docusaurus\//,
  /\bfrom\s+["']@docusaurus["']/
];

describe("architecture", () => {
  it("ships at least the modules this test is meant to guard", () => {
    // Guard the guard: a glob that silently matches nothing would make every assertion below vacuous.
    expect(sources).toContain("index.ts");
    expect(sources.length).toBeGreaterThanOrEqual(5);
  });

  it("imports nothing from Node and nothing from Docusaurus", () => {
    const offenders: string[] = [];
    for (const name of sources) {
      const text = withoutTemplates(read(name));
      for (const pattern of FORBIDDEN) if (pattern.test(text)) offenders.push(`${name} matches ${pattern}`);
    }
    expect(offenders).toEqual([]);
  });

  it("still sees an import that hides outside a template literal", () => {
    // Guard the stripper: if `withoutTemplates` ever ate too much, the check above would pass on
    // anything, and a real violation would ship.
    const disguised = 'const emitted = `import Head from "@docusaurus/Head";`;\nimport { join } from "node:path";\n';
    const stripped = withoutTemplates(disguised);
    expect(FORBIDDEN.some(pattern => pattern.test(stripped))).toBe(true);
    expect(/@docusaurus/.test(stripped)).toBe(false);
  });

  it("declares the core as its only dependency, and no peers", () => {
    const manifest = JSON.parse(read("../package.json")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(["docs-overlay"]);
    expect(manifest.peerDependencies).toBeUndefined();
  });
});
