// Materialises a real overlay tree onto disk and reports what it wrote.
//
// A stand-in for the CLI that does not exist yet, kept deliberately small: its only job is to prove the
// adapter reproduces the pre-migration trees byte for byte. Everything filesystem-shaped lives here,
// which is the boundary the adapter is designed around.
//
// Usage: tsx scratch-materialize.ts <siteDir> <outRoot>
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { createOverlay, type ContentEntry } from "../../../packages/core/src/index.js";
import {
  docusaurusSlugify,
  declaredSlug,
  materialize,
  readDocusaurusDirectives,
  type DocusaurusMeta
} from "../../../packages/adapters/docusaurus/src/index.js";

const [siteDirArg, outRootArg] = process.argv.slice(2);
const siteDir = resolve(siteDirArg!);
const outRoot = resolve(outRootArg!);
const contentDir = join(siteDir, "content", "docs");

const walk = (dir: string, base = dir, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, base, out);
    else out.push(relative(base, path).split("\\").join("/"));
  }
  return out;
};

/**
 * Enough YAML for this corpus, and no more.
 *
 * The real CLI will use a parser; here a hand-rolled reader keeps the check dependency-free, and the
 * shapes it has to handle are exactly the ones the migration wrote: `title`, `slug`, and an `overlay:`
 * block of scalar keys.
 */
const parseFrontMatter = (text: string): Record<string, unknown> => {
  const normalised = text.replace(/\r\n/g, "\n");
  if (!normalised.startsWith("---\n")) return {};
  const end = normalised.indexOf("\n---", 3);
  if (end === -1) return {};

  const out: Record<string, unknown> = {};
  let overlay: Record<string, unknown> | undefined;

  for (const line of normalised.slice(4, end).split("\n")) {
    const nested = /^\s+([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (overlay !== undefined && nested !== null) {
      overlay[nested[1]!] = scalar(nested[2]!);
      continue;
    }
    const top = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (top === null) continue;
    if (top[1] === "overlay") {
      overlay = {};
      out["overlay"] = overlay;
      continue;
    }
    overlay = undefined;
    out[top[1]!] = scalar(top[2]!);
  }
  return out;
};

const scalar = (raw: string): unknown => {
  const value = raw.trim().replace(/^["']|["']$/g, "");
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

const slugify = docusaurusSlugify();
const entries: ContentEntry<DocusaurusMeta>[] = [];

for (const version of readdirSync(contentDir)) {
  const versionDir = join(contentDir, version);
  if (!statSync(versionDir).isDirectory()) continue;

  for (const rest of walk(versionDir)) {
    const absolute = join(versionDir, rest);
    const path = `${version}/${rest}`;

    if (rest === "sidebars.json") {
      entries.push({ path, kind: "meta", meta: { sidebars: JSON.parse(readFileSync(absolute, "utf8")) }, origin: absolute });
      continue;
    }
    if (!/\.mdx?$/.test(rest)) continue;

    const frontMatter = parseFrontMatter(readFileSync(absolute, "utf8"));
    // Explicit, always: a declared `slug:` wins over the path, and deriving it would make every
    // directive aimed at such a page miss silently.
    const slug = declaredSlug(rest, frontMatter["slug"]) ?? slugify(rest);
    entries.push({ path, kind: "page", meta: { frontMatter }, slug, origin: absolute });
  }
}

const overlay = createOverlay<DocusaurusMeta>({
  source: entries,
  channels: ["next"],
  slugify,
  readDirectives: readDocusaurusDirectives()
});

const plan = materialize(overlay, { routeBasePath: "/", labels: { next: "Next 🚧" } });

rmSync(outRoot, { recursive: true, force: true });
let copied = 0;
let written = 0;
for (const file of plan.files) {
  const target = join(outRoot, file.path);
  mkdirSync(dirname(target), { recursive: true });
  if (file.kind === "copy") {
    copyFileSync(file.from, target);
    copied += 1;
  } else {
    writeFileSync(target, file.contents, "utf8");
    written += 1;
  }
}

console.log(`entries        ${entries.length}`);
const describe = (version: (typeof plan.versions)[number]): string => (version.path === "" ? `${version.id} (root)` : `${version.id} -> /${version.path}`);
console.log(`versions       ${plan.versions.map(describe).join(", ")}`);
console.log(`copied         ${copied}`);
console.log(`written        ${written}`);
console.log(`redirects      ${plan.redirects.length}`);
console.log();
console.log("docsOptions", JSON.stringify(plan.docsOptions, undefined, 2));
console.log();
for (const diagnostic of plan.diagnostics) console.log(`${diagnostic.severity.padEnd(7)} ${diagnostic.code.padEnd(26)} ${diagnostic.message}`);
console.log();
console.log(`digest of the whole output: ${digestOf(outRoot)}`);

function digestOf(root: string): string {
  const hash = createHash("sha256");
  for (const path of walk(root).sort()) hash.update(path).update(readFileSync(join(root, path)));
  return hash.digest("hex").slice(0, 16);
}
