// Validates a migration journal.
//
// The journal exists to specify a migration command and a documentation page without either of them
// being invented. That only holds if the journal was written at the wall, one entry per step, and if
// the mechanical/judgement split was made at the time rather than reconstructed afterwards. Every
// check below defends one of those two properties.
//
// Usage: node scripts/check-journal.mjs [notes/migrations/<name>/journal.jsonl] [--repo <path>]
//
// `--repo` is the repository the migration was performed in, needed for the git cross-check. Without
// it the cross-check is skipped and said to be skipped — a silent partial validation would be worse
// than no validation, because it reads as a pass.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const argv = process.argv.slice(2);
const repoIndex = argv.indexOf("--repo");
const repo = repoIndex === -1 ? undefined : argv[repoIndex + 1];
const positional = argv.filter((value, index) => index !== repoIndex && index !== repoIndex + 1);
const file = positional[0] ?? join(root, "notes", "migrations", "mint-11.14.0", "journal.jsonl");

const PHASES = new Set(["setup", "detect", "strategy", "move", "prune", "classify", "tombstone", "rename", "sidebars", "config", "build", "verify", "wrapup"]);
const KINDS = new Set(["mechanical", "judgement", "pitfall", "verification", "measurement"]);

const problems = [];
const fail = (seq, message) => problems.push(`entry ${seq}: ${message}`);

if (!existsSync(file)) {
  console.error(`check-journal: no journal at ${file}`);
  process.exit(1);
}

const lines = readFileSync(file, "utf8")
  .split("\n")
  .filter(line => line.trim() !== "");
if (lines.length === 0) {
  console.error(`check-journal: ${file} holds no entries`);
  process.exit(1);
}

const entries = [];
for (const [index, line] of lines.entries()) {
  try {
    entries.push(JSON.parse(line));
  } catch {
    // Reported against the line number, not the seq: a line that does not parse has no seq to name.
    problems.push(`line ${index + 1}: not valid JSON — the journal is append-only, so a broken line means something rewrote it`);
  }
}

for (const [index, entry] of entries.entries()) {
  const seq = entry.seq ?? `?(line ${index + 1})`;

  if (entry.seq !== index + 1) fail(seq, `seq is ${entry.seq}, expected ${index + 1} — entries are append-only and never reordered`);
  if (!PHASES.has(entry.phase)) fail(seq, `unknown phase "${entry.phase}"`);
  if (!KINDS.has(entry.kind)) fail(seq, `unknown kind "${entry.kind}"`);
  if (typeof entry.what !== "string" || entry.what.trim() === "") fail(seq, "what is empty");

  // The load-bearing field. Everything the CLI will do is derived from it, so it is never optional
  // and never inferred later: inferring it afterwards is exactly the reconstruction this guards.
  if (typeof entry.scriptable !== "boolean") fail(seq, "scriptable is missing — it is mandatory on every entry");

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(entry.at ?? "")) fail(seq, `at "${entry.at}" is not an ISO instant`);
  else if (index > 0 && entries[index - 1].at > entry.at) fail(seq, `at ${entry.at} precedes entry ${index}'s ${entries[index - 1].at}`);

  if (entry.kind === "judgement") {
    if (!entry.decision) fail(seq, "kind=judgement without decision");
    if (!entry.why) fail(seq, "kind=judgement without why");
    if (!Array.isArray(entry.alternatives) || entry.alternatives.length === 0) {
      fail(seq, "kind=judgement without alternatives — the options not taken are what become the command's prompt");
    }
    if (entry.scriptable !== false) fail(seq, "kind=judgement with scriptable=true — if a tool could decide it, it is not a judgement");
  }

  if (entry.kind === "pitfall") {
    if (!entry.pitfall) fail(seq, "kind=pitfall without pitfall");
    if (!entry.workaround) fail(seq, "kind=pitfall without workaround");
    if (!entry.detectable_by) fail(seq, "kind=pitfall without detectable_by — an undetectable pitfall cannot become a refusal");
  }

  if (entry.kind === "verification" && !entry.verification?.result) {
    fail(seq, "kind=verification without verification.result — an expectation with no result is not a verification");
  }

  if (entry.kind === "measurement" && !entry.command) {
    fail(seq, "kind=measurement without command — a figure nobody can re-derive is an assertion, not a measurement");
  }
}

// Cross-check against git. A backfilled entry can fabricate a plausible timestamp, and it can fabricate
// plausible file counts, but doing both consistently against real commit ranges is another matter. This
// is the check that makes "written at the wall" verifiable rather than promised.
let crossChecked = 0;
if (repo && existsSync(join(repo, ".git"))) {
  const git = args => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

  for (const [index, entry] of entries.entries()) {
    if (!entry.repo_head) continue;
    try {
      git(["cat-file", "-e", `${entry.repo_head}^{commit}`]);
    } catch {
      fail(entry.seq, `repo_head ${entry.repo_head} is not a commit this repository knows`);
      continue;
    }

    const previous = entries[index - 1];
    if (!previous?.repo_head || previous.repo_head === entry.repo_head) continue;

    const numstat = git(["diff", "--numstat", previous.repo_head, entry.repo_head]);
    const touched = numstat === "" ? 0 : numstat.split("\n").length;
    const claimed = (entry.files?.added ?? 0) + (entry.files?.removed ?? 0) + (entry.files?.changed ?? 0);
    // Renames report as one path pair in --numstat, and a commit may carry more than one journal
    // entry, so this is a floor rather than an equality: it catches an entry that claims work git
    // never saw, without failing on the ordinary case of several entries per commit.
    if (claimed > 0 && touched === 0) {
      fail(entry.seq, `claims ${claimed} file(s) but git sees no change between ${previous.repo_head} and ${entry.repo_head}`);
    }
    crossChecked += 1;
  }
} else if (repo) {
  problems.push(`--repo ${repo} is not a git repository`);
}

const counts = entries.reduce((accumulator, entry) => {
  accumulator[entry.kind] = (accumulator[entry.kind] ?? 0) + 1;
  return accumulator;
}, {});

console.log(`check-journal: ${entries.length} entr${entries.length === 1 ? "y" : "ies"} in ${file}`);
console.log(
  `  kinds        ${Object.entries(counts)
    .map(([kind, n]) => `${kind} ${n}`)
    .join(" · ")}`
);
console.log(`  scriptable   ${entries.filter(e => e.scriptable).length} mechanical · ${entries.filter(e => !e.scriptable).length} need a human`);
console.log(`  git check    ${repo ? `${crossChecked} adjacent pair(s) cross-checked` : "skipped (pass --repo <path> to enable)"}`);

if (problems.length > 0) {
  console.error(`\ncheck-journal: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log("check-journal: ok");
