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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const journalPath = process.argv[2] ?? join(root, "notes", "migrations", "mint-11.14.0", "journal.jsonl");

// Where the derived material is supposed to have landed. A journal entry counts as covered when its subject
// is discussed in any of these — one page may reasonably absorb several entries.
const PAGES = [
  join(root, "apps", "docs", "content", "docs", "next", "staying-on-docusaurus.md"),
  join(root, "apps", "docs", "content", "docs", "next", "migrating-to-fumadocs.md"),
  join(root, "apps", "docs", "content", "docs", "next", "adapters.md"),
  join(root, "packages", "cli", "README.md"),
  join(root, "packages", "adapters", "docusaurus", "README.md")
];

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
  41: ["onBrokenLinks"]
};

if (!existsSync(journalPath)) {
  console.error(`check-coverage: no journal at ${journalPath}`);
  process.exit(1);
}

const entries = readFileSync(journalPath, "utf8")
  .split("\n")
  .filter(line => line.trim() !== "")
  .map(line => JSON.parse(line));

const missingPages = PAGES.filter(page => !existsSync(page));
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
