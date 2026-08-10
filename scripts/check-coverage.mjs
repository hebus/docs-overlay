// Checks that the documentation still covers what the migration journal recorded.
//
// The journal exists so that a migration guide and a command surface are *derived* rather than invented.
// Nothing enforces that on its own: a page written from the journal today drifts from it tomorrow, and the
// entries most easily dropped are the ones that cost the most to rediscover — the judgements a tool cannot
// make, and the pitfalls that fail silently.
//
// So this asserts the mapping in the one direction that matters. It does not check prose quality; it checks
// that nothing was quietly left out.
//
// Usage: node scripts/check-coverage.mjs [notes/migrations/<name>/journal.jsonl]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const journalPath = process.argv[2] ?? join(root, "notes", "migrations", "mint-11.14.0", "journal.jsonl");
const content = join(root, "apps", "docs", "content", "docs");

/**
 * Guide pages, named **without a version**, because the version they live in moves.
 *
 * The first version of this script hardcoded `next/…`, and `cut-docs.mjs` broke it on the very next
 * release: cutting renames `next/` to the engine's new version, so the guides moved to `0.2.0/` and every
 * path here stopped existing. Hardcoding a version folder in a repository whose whole subject is that
 * version folders move was a poor choice, and CI caught it on the "chore: version packages" branch.
 *
 * Each name resolves to the newest version that serves it. Newest rather than "any", because coverage is
 * about what the documentation says *now*: a term surviving only in an archived version means the current
 * documentation dropped it, which is exactly what this check is for.
 */
const GUIDES = ["staying-on-docusaurus.md", "migrating-to-fumadocs.md", "adapters.md"];

/** Pages outside the versioned tree, whose paths do not move. */
const FIXED = [join(root, "packages", "cli", "README.md"), join(root, "packages", "adapters", "docusaurus", "README.md")];

/**
 * Just enough version ordering to pick the newest folder, hand-written for the same reason
 * `cut-docs.mjs` duplicates its version regex: these scripts run before anything is built, so there is no
 * `dist/` to import the engine's comparator from.
 *
 * Channels — folders that are not version numbers, such as `next` — sort last, matching the engine.
 */
const VERSION = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/;

function versionRank(name) {
  const match = VERSION.exec(name);
  if (match === null) return undefined;
  // A prerelease ranks below the release of the same number, hence the trailing 0/1.
  return [Number(match[1] ?? 0), Number(match[2] ?? 0), Number(match[3] ?? 0), match[4] === undefined ? 1 : 0];
}

function orderedVersions() {
  if (!existsSync(content)) return [];
  const folders = readdirSync(content).filter(name => statSync(join(content, name)).isDirectory());
  const releases = folders.filter(name => versionRank(name) !== undefined);
  const channels = folders.filter(name => versionRank(name) === undefined);

  releases.sort((a, b) => {
    const left = versionRank(a);
    const right = versionRank(b);
    for (let index = 0; index < 4; index += 1) if (left[index] !== right[index]) return left[index] - right[index];
    return a.localeCompare(b);
  });

  // Oldest first, channels last, so the newest thing is the end of the list either way.
  return [...releases, ...channels];
}

const versions = orderedVersions();

/** Newest version folder serving `name`, or `undefined` when no version does. */
function newestServing(name) {
  for (const version of [...versions].reverse()) {
    const path = join(content, version, name);
    if (existsSync(path)) return { version, path };
  }
  return undefined;
}

const resolved = GUIDES.map(name => ({ name, found: newestServing(name) }));
const unresolved = resolved.filter(entry => entry.found === undefined);
const PAGES = [...resolved.filter(entry => entry.found !== undefined).map(entry => entry.found.path), ...FIXED];

/**
 * Terms that must appear somewhere in the documentation for an entry to count as covered.
 *
 * Keyed by journal `seq`, because that is stable — a wording change in the journal should not silently
 * disable a check. An entry with no key here is not required to be documented: plenty of steps are internal
 * to this repository and would only be noise in a user's guide. The point is that *omitting* one is a
 * decision recorded here, not an oversight.
 */
const REQUIRED = {
  4: ["text=auto", "CRLF"],
  9: ["slug", "extension"],
  10: ["identical", "filename"],
  14: ["git mv"],
  20: ["replacedBy"],
  21: ["replacedBy"],
  22: ["replacedBy"],
  24: ["git mv"],
  27: ["byte", "copy"],
  28: ["route, not a page"],
  29: ["template literal"],
  30: ["ambient types", "no I/O"],
  34: ["import.meta", "jiti"],
  35: ["require"],
  37: ["leading slash"],
  38: ["MSYS"],
  39: ["useBaseUrl"],
  40: ["export", "module"],
  41: ["onBrokenLinks"],
  // Internal, declared rather than omitted, because a judgement's silence has to be deliberate: entry 52 is
  // about the line endings of one site's `package-lock.json` after npm rewrote it. Real, and it cost time,
  // but it belongs to adding a devDependency on Windows rather than to migrating a site onto an overlay —
  // and entry 55 records that its stated cause was wrong anyway. A guide that carried it would be teaching
  // npm's behaviour under the heading of ours. The CRLF lesson a reader does need is entry 4's.
  52: []
};

if (!existsSync(journalPath)) {
  console.error(`check-coverage: no journal at ${journalPath}`);
  process.exit(1);
}

const entries = readFileSync(journalPath, "utf8")
  .split("\n")
  .filter(line => line.trim() !== "")
  .map(line => JSON.parse(line));

// A guide no version serves at all has been deleted, which is a real failure. Name the versions searched,
// so the answer is not "it is missing" when the truth is "you are looking in the wrong place".
if (unresolved.length > 0) {
  console.error(`check-coverage: no version under ${content.replace(root, "")} serves:\n  ${unresolved.map(entry => entry.name).join("\n  ")}`);
  console.error(`  versions searched, oldest first: ${versions.join(", ") || "(none)"}`);
  process.exit(1);
}

const missingPages = FIXED.filter(page => !existsSync(page));
if (missingPages.length > 0) {
  console.error(`check-coverage: these pages do not exist:\n  ${missingPages.map(page => page.replace(root, "")).join("\n  ")}`);
  process.exit(1);
}

const corpus = PAGES.map(page => readFileSync(page, "utf8")).join("\n\n");
const problems = [];

// Every judgement must be discussed somewhere. These are the decisions a tool cannot make, so a guide that
// omits one leaves its reader to rediscover it — which is the single most expensive omission possible.
for (const entry of entries.filter(entry => entry.kind === "judgement")) {
  const terms = REQUIRED[entry.seq];
  if (terms === undefined) {
    problems.push(`entry ${entry.seq} is a judgement with no coverage terms declared — add them, or say here why it is internal`);
    continue;
  }
  for (const term of terms) {
    if (!corpus.includes(term)) problems.push(`entry ${entry.seq} (judgement): the documentation never mentions "${term}"`);
  }
}

// Pitfalls, same reasoning: each one fails silently, so a reader who is not warned meets it the hard way.
for (const entry of entries.filter(entry => entry.kind === "pitfall")) {
  const terms = REQUIRED[entry.seq];
  if (terms === undefined) continue; // Declared as internal by omission — see REQUIRED's comment.
  for (const term of terms) {
    if (!corpus.includes(term)) problems.push(`entry ${entry.seq} (pitfall): the documentation never mentions "${term}"`);
  }
}

// The reverse direction, as a warning only: a declared term whose entry has disappeared means the journal
// was rewritten, which the append-only rule forbids.
const known = new Set(entries.map(entry => entry.seq));
const orphans = Object.keys(REQUIRED)
  .map(Number)
  .filter(seq => !known.has(seq));

const judgements = entries.filter(entry => entry.kind === "judgement").length;
const pitfalls = entries.filter(entry => entry.kind === "pitfall").length;
const covered = Object.keys(REQUIRED).filter(seq => known.has(Number(seq))).length;

console.log(`check-coverage: ${entries.length} entries · ${judgements} judgement(s) · ${pitfalls} pitfall(s)`);
console.log(`  ${covered} entr${covered === 1 ? "y" : "ies"} required to appear in the documentation, across ${PAGES.length} page(s)`);
// Printed on success too: this is the line that shows a release cut moved the guides and that the check
// followed them, rather than silently reading an older copy.
for (const entry of resolved) console.log(`  ${entry.name.padEnd(28)} from ${entry.found.version}`);
if (orphans.length > 0) console.log(`  note: coverage declared for ${orphans.join(", ")}, which the journal does not contain`);

if (problems.length > 0) {
  console.error(`\ncheck-coverage: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    `\nThe journal recorded these because they cost something to discover. Document them, or\nremove their entry from REQUIRED in ${dirname(fileURLToPath(import.meta.url)).replace(root, "")}/check-coverage.mjs with a reason.`
  );
  process.exit(1);
}
console.log("check-coverage: ok");
