// Asserts the exported HTML, not the plan.
//
// The Docusaurus adapter is unit-tested against the tree it *describes*; nothing until now proved that
// Docusaurus accepts that tree. This is the part only a real build can answer: that every generated
// sidebar is valid for its own version, that the stubs are routes, and that `onBrokenLinks: 'throw'`
// passes.
//
// Run by `postbuild`, so a regression fails the build rather than shipping a site that looks fine.

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const build = join(root, "build");
const content = join(root, "content", "docs");

let failures = 0;
const check = (label, condition) => {
  if (condition) {
    console.log(`  ok    ${label}`);
    return;
  }
  console.error(`  FAIL  ${label}`);
  failures += 1;
};

const pagePath = url => join(build, ...url.split("/").filter(Boolean), "index.html");
const exists = url => existsSync(pagePath(url));
/**
 * Rendered text, scripts stripped, so an assertion reads the page rather than its hydration payload.
 *
 * Inline code becomes a `<code>` element, so the backticks an author wrote are gone by the time this
 * sees the prose — assertions below match the rendered words, not the Markdown source.
 */
const text = url =>
  exists(url)
    ? readFileSync(pagePath(url), "utf8")
        .replace(/<script[\s\S]*?<\/script>/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
    : "";
const html = url => (exists(url) ? readFileSync(pagePath(url), "utf8") : "");

console.log("\ndocusaurus-classic: asserting the exported site\n");

// The one failure that would make every other assertion here meaningless. `docs-overlay-cli` depends on
// `docs-overlay@^0.2.0`, and this example is outside the workspaces — so npm is free to satisfy that from
// the registry instead of the `file:` link, and would, the moment the local core's version leaves that
// range. The example would then go on passing while testing a published package.
for (const name of ["docs-overlay", "docs-overlay-docusaurus", "docs-overlay-cli"]) {
  const installed = join(root, "node_modules", name);
  const resolved = existsSync(installed) ? realpathSync(installed).split("\\").join("/") : "";
  check(`${name} is the workspace copy, not one from the registry`, resolved.includes("/packages/"));
}

// Three versions, at the shapes `lastVersion` and the version paths put them.
check("the newest release is served at the root", exists("/"));
check("the older release keeps its own prefix", exists("/1.0.0"));
check("the channel is routed", exists("/next"));

// Inheritance. `intro` and `api/reference` exist only in 1.0.0, and all three versions serve them.
check("2.0.0 owns no intro of its own", !existsSync(join(content, "2.0.0", "intro.md")));
check("yet the root serves intro", text("/").includes("The complete tree lives in"));
check("and so does the channel", text("/next").includes("The complete tree lives in"));
check("and so does the older release", text("/1.0.0").includes("The complete tree lives in"));

// Override: the same slug, two bodies, and the channel inherits the newer one.
check("the root serves 2.0.0's getting-started", text("/guide/getting-started").includes("This is the 2.0.0 text"));
check("1.0.0 still serves its own", text("/1.0.0/guide/getting-started").includes("This is the 1.0.0 text"));
check("the channel inherits 2.0.0's", text("/next/guide/getting-started").includes("This is the 2.0.0 text"));

// Rename. The vacated slug is a route rather than a 404, and the version that predates the rename still
// serves the real page there.
check("the renamed page is served at its new slug", text("/guide/new-api").includes("redirects here, permanently"));
check("the old slug is still routed", exists("/guide/old-api"));
check("the old slug redirects", /http-equiv="refresh"/i.test(html("/guide/old-api")) && text("/guide/old-api").includes("guide/new-api"));
check("the old slug is unlisted, so it is not indexed", text("/guide/old-api").includes("This page is unlisted"));
check("1.0.0 serves the old slug as a real page", text("/1.0.0/guide/old-api").includes("Renamed to guide/new-api"));

// Tombstone. Removed, and it says so — where it went, and where it last existed.
check("the removed page is routed, not 404", exists("/guide/legacy"));
check("it names the version that removed it", text("/guide/legacy").includes("removed in 2.0.0"));
check("it names what replaced it", text("/guide/legacy").includes("guide/new-api"));
check("it names where it last existed", text("/guide/legacy").includes("1.0.0"));
check("1.0.0 still serves it as a real page", text("/1.0.0/guide/legacy").includes("Removed in 2.0.0 by a tombstone"));

// Alias: a second URL for one page, with the canonical named.
check("the alias is routed", exists("/api"));
check("the alias names its canonical", text("/api").includes("api/reference"));
check("the page itself is at its own slug", text("/api/reference").includes("Reachable at api/reference"));

// Navigation. An inherited sidebar adapts to the version reading it: it follows the rename and drops the
// page the tombstone removed, rather than naming ids that version does not serve.
const sidebarOf = version => readFileSync(join(root, "versioned_sidebars", `version-${version}-sidebars.json`), "utf8");
check("1.0.0's sidebar names the pre-rename slug", sidebarOf("1.0.0").includes("guide/old-api"));
check("2.0.0's sidebar follows the rename", sidebarOf("2.0.0").includes("guide/new-api"));
check("2.0.0's sidebar drops the old slug", !sidebarOf("2.0.0").includes("guide/old-api"));
check("2.0.0's sidebar drops the removed page", !sidebarOf("2.0.0").includes("guide/legacy"));

// The mistake that fails a Docusaurus build outright, with `These sidebar document ids do not exist`:
// one shared sidebar applied to every version. Each generated sidebar has to be valid for its own tree.
const docIdsOf = json => [...json.matchAll(/"id":\s*"([^"]+)"/g)].map(match => match[1]);
const servesDoc = (dir, id) => [".md", ".mdx"].some(extension => existsSync(join(dir, `${id}${extension}`)));
for (const version of ["1.0.0", "2.0.0"]) {
  const dir = join(root, "versioned_docs", `version-${version}`);
  const missing = docIdsOf(sidebarOf(version)).filter(id => !servesDoc(dir, id));
  check(`every doc id in ${version}'s sidebar resolves to a file in ${version}`, missing.length === 0);
}

// The version list Docusaurus reads: released versions only, newest first. A channel is not a release.
const versions = JSON.parse(readFileSync(join(root, "versions.json"), "utf8"));
check("versions.json is newest first and excludes the channel", JSON.stringify(versions) === JSON.stringify(["2.0.0", "1.0.0"]));

// Pages are copied, never re-emitted, so what ships is what was authored — byte for byte.
const authored = readFileSync(join(content, "1.0.0", "intro.md"));
const materialised = readFileSync(join(root, "versioned_docs", "version-1.0.0", "intro.md"));
check("a page reaches the generated tree byte for byte", materialised.equals(authored));

// And the point of the whole exercise: one authored file per page, not one per version.
const authoredFiles = countFiles(content);
const generatedFiles = countFiles(join(root, "versioned_docs"));
check(`fewer authored files (${authoredFiles}) than generated ones (${generatedFiles})`, authoredFiles < generatedFiles);

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.name.startsWith(".")) continue;
    total += name.isDirectory() ? countFiles(join(dir, name.name)) : 1;
  }
  return total;
}

if (failures > 0) {
  console.error(`\ndocusaurus-classic: ${failures} assertion(s) failed.\n`);
  process.exit(1);
}
console.log("\ndocusaurus-classic: the exported site is what it should be.\n");
