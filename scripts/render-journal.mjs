// Renders a migration journal into the documents that are derived from it.
//
// The journal is the source of truth and is append-only JSONL. Everything here is a projection of it,
// regenerated rather than edited: the moment someone edits `journal.md` by hand, the split between what
// was recorded at the wall and what was tidied up afterwards is gone, and that split is the only reason
// the journal is worth keeping.
//
// Usage: node scripts/render-journal.mjs [notes/migrations/<name>/journal.jsonl]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const file = process.argv[2] ?? join(root, "notes", "migrations", "mint-11.14.0", "journal.jsonl");
const here = dirname(file);
const derived = join(here, "derived");

const entries = readFileSync(file, "utf8")
  .split("\n")
  .filter(line => line.trim() !== "")
  .map(line => JSON.parse(line));

const say = message => console.log(`render-journal: ${message}`);

const escape = value => String(value ?? "").replace(/\|/g, "\\|");
const code = value => (value === null || value === undefined ? "" : `\`${escape(value)}\``);

// ── journal.md ────────────────────────────────────────────────────────────────────────────────────
const KIND_LABEL = {
  mechanical: "mechanical",
  judgement: "**judgement**",
  pitfall: "**pitfall**",
  verification: "verification",
  measurement: "measurement"
};

const phases = [...new Set(entries.map(entry => entry.phase))];

const journal = [
  "# Migration journal",
  "",
  `Generated from \`journal.jsonl\` by \`scripts/render-journal.mjs\`. **Do not edit.**`,
  "",
  `${entries.length} entries across ${phases.length} phases. ` +
    `${entries.filter(entry => entry.scriptable).length} steps a tool could take unattended, ` +
    `${entries.filter(entry => !entry.scriptable).length} that need a human.`,
  ""
];

for (const entry of entries) {
  journal.push(`## ${entry.seq}. ${entry.phase} — ${KIND_LABEL[entry.kind] ?? entry.kind}`, "");
  journal.push(entry.what, "");
  if (entry.command) journal.push("```sh", entry.command, "```", "");
  if (entry.kind === "judgement") {
    journal.push(`**Decision** ${entry.decision}`, "");
    journal.push(`**Why** ${entry.why}`, "");
    if (entry.alternatives?.length) journal.push(`**Not taken** ${entry.alternatives.map(code).join(" · ")}`, "");
  }
  if (entry.kind === "pitfall") {
    journal.push(`**Pitfall** ${entry.pitfall}`, "");
    journal.push(`**Workaround** ${entry.workaround}`, "");
    journal.push(`**Detectable by** ${entry.detectable_by}`, "");
  }
  if (entry.verification) {
    journal.push(`**Verified** \`${entry.verification.command}\` → expected ${entry.verification.expected}, got ${entry.verification.result}`, "");
  }
  const files = entry.files ?? {};
  const touched = (files.added ?? 0) + (files.removed ?? 0) + (files.changed ?? 0);
  const facts = [`\`${entry.repo_head}\``, entry.at];
  if (touched > 0) facts.push(`+${files.added ?? 0} −${files.removed ?? 0} ~${files.changed ?? 0}`);
  if (entry.cli) facts.push(`owned by \`${entry.cli}\``);
  journal.push(`<sub>${facts.join(" · ")}</sub>`, "");
}

writeFileSync(join(here, "journal.md"), `${journal.join("\n")}\n`, "utf8");
say(`journal.md — ${entries.length} entries`);

// ── derived/ ──────────────────────────────────────────────────────────────────────────────────────
mkdirSync(derived, { recursive: true });

// The command surface. Grouped by the command that will own each step, because that grouping *is* the
// specification: a command with no steps under it has nothing to justify it.
const byCli = new Map();
for (const entry of entries.filter(entry => entry.scriptable)) {
  const key = entry.cli ?? "(no command — migration-specific)";
  if (!byCli.has(key)) byCli.set(key, []);
  byCli.get(key).push(entry);
}

const steps = ["# Steps a tool can take unattended", "", "Derived from every `scriptable: true` entry, grouped by the command that owns it.", ""];
for (const [cli, group] of [...byCli].sort((a, b) => a[0].localeCompare(b[0]))) {
  steps.push(`## \`${cli}\``, "");
  for (const entry of group) {
    steps.push(`- **${entry.seq}** (${entry.phase}) ${entry.what}`);
    if (entry.command) steps.push(`  \`\`\`sh\n  ${entry.command}\n  \`\`\``);
  }
  steps.push("");
}
writeFileSync(join(derived, "steps.md"), `${steps.join("\n")}\n`, "utf8");
say(`derived/steps.md — ${byCli.size} command group(s)`);

// The prompts. Every judgement is a question the command must ask, and `alternatives` is the option list.
const judgements = entries.filter(entry => !entry.scriptable);
const decisions = [
  "# Decisions only a human can make",
  "",
  "Derived from every `scriptable: false` entry. Each one is a prompt the migration command must ask,",
  "and `Not taken` is its option list. Note how often the answer was *nothing*: a prompt that pushes",
  "towards naming a target would have produced three wrong redirects here.",
  ""
];
for (const entry of judgements) {
  decisions.push(`## ${entry.seq}. ${entry.decision}`, "");
  decisions.push(entry.why, "");
  if (entry.alternatives?.length) decisions.push(`**Options not taken** ${entry.alternatives.map(code).join(" · ")}`, "");
}
writeFileSync(join(derived, "decisions.md"), `${decisions.join("\n")}\n`, "utf8");
say(`derived/decisions.md — ${judgements.length} judgement(s)`);

// The refusals. `detectable_by` is what turns "I hit this" into "the tool refuses this, and says why".
const pitfalls = entries.filter(entry => entry.kind === "pitfall");
const table = [
  "# Pitfalls, and the checks that catch them",
  "",
  'Derived from every `kind: "pitfall"` entry. `Detectable by` is the refusal or diagnostic the tool',
  "should carry, so the next person meets an error message instead of the pitfall.",
  "",
  "| # | Phase | Pitfall | Workaround | Detectable by |",
  "|---|---|---|---|---|"
];
for (const entry of pitfalls) {
  table.push(`| ${entry.seq} | ${entry.phase} | ${escape(entry.pitfall)} | ${escape(entry.workaround)} | ${escape(entry.detectable_by)} |`);
}
writeFileSync(join(derived, "pitfalls.md"), `${table.join("\n")}\n`, "utf8");
say(`derived/pitfalls.md — ${pitfalls.length} pitfall(s)`);

const verifications = entries.filter(entry => entry.kind === "verification" || entry.kind === "measurement");
say(
  `${verifications.length} verification/measurement entr${verifications.length === 1 ? "y" : "ies"} available for the documentation's expected-output blocks`
);
