// Prototype of planSnapshots()'s rename detection, run against the real corpus.
//
// Deliberately written with the metric the core will use (line-multiset intersection) rather than the
// LCS that `diff` reports, so the ranking it produces is the ranking the shipped heuristic produces.
// Its output is what corpus.md records and what the core's pinning test asserts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const [parentRoot, childRoot] = process.argv.slice(2);

const walk = (dir, base = dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, base, out);
    else if (/\.mdx?$/.test(name)) out.push(relative(base, path).split("\\").join("/"));
  }
  return out;
};

const slugOf = file => file.replace(/\.mdx?$/, "");
const read = (root, file) => readFileSync(join(root, file));

// Frontmatter is excluded on purpose: `sidebar_class_name` sits on most of these files and would pull
// every pair towards each other, flattening the very differences the score exists to expose.
const bodyLines = bytes => {
  let text = bytes.toString("utf8").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  const frontmatter = match ? match[1] : "";
  if (match) text = text.slice(match[0].length);
  const lines = text
    .split("\n")
    .map(line => line.trim().replace(/\s+/g, " "))
    .filter(line => line !== "");
  return { lines, title: /^title:\s*(.*)$/m.exec(frontmatter)?.[1]?.trim() ?? "" };
};

// Multiset intersection over line hashes, normalised by the larger side. Monotone above LCS and O(n),
// which is what lets the core keep it dependency-free.
const contentScore = (a, b) => {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const counts = new Map();
  for (const line of a) counts.set(line, (counts.get(line) ?? 0) + 1);
  let shared = 0;
  for (const line of b) {
    const left = counts.get(line) ?? 0;
    if (left > 0) {
      counts.set(line, left - 1);
      shared += 1;
    }
  }
  return shared / Math.max(a.length, b.length);
};

const stemScore = (a, b) => {
  const left = a.split("/").at(-1),
    right = b.split("/").at(-1);
  if (left === right) return 1;
  // `drawer.component` -> `drawer`: the Angular file-suffix convention, and the case a name-only
  // heuristic misses even when the bodies are 96% identical.
  const strip = value => value.replace(/\.[a-z]+$/, "");
  if (strip(left) === strip(right)) return 0.7;
  if (left.startsWith(right) || right.startsWith(left)) return 0.5;
  return 0;
};

const pathScore = (a, b) => {
  const left = a.split("/").slice(0, -1),
    right = b.split("/").slice(0, -1);
  let shared = 0;
  while (shared < left.length && shared < right.length && left[shared] === right[shared]) shared += 1;
  const depth = Math.max(left.length, right.length);
  return depth === 0 ? 1 : shared / depth;
};

const titleScore = (a, b) => {
  const fold = value =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
  if (!a || !b) return 0;
  return fold(a) === fold(b) ? 1 : 0.5 * (fold(a).includes(fold(b)) || fold(b).includes(fold(a)) ? 1 : 0);
};

const parentFiles = walk(parentRoot),
  childFiles = walk(childRoot);
const parent = new Map(parentFiles.map(f => [slugOf(f), f]));
const child = new Map(childFiles.map(f => [slugOf(f), f]));

const gone = [...parent.keys()].filter(slug => !child.has(slug));
const added = [...child.keys()].filter(slug => !parent.has(slug));
const shared = [...child.keys()].filter(slug => parent.has(slug));
const identical = shared.filter(slug => read(parentRoot, parent.get(slug)).equals(read(childRoot, child.get(slug))));

console.log(`parent ${parent.size} slugs · child ${child.size} slugs`);
console.log(`shared ${shared.length} -> identical ${identical.length} / overrides ${shared.length - identical.length}`);
console.log(`added ${added.length} · gone ${gone.length}`);
console.log();

const ACCEPT = 0.75,
  ASK = 0.45,
  MARGIN = 0.15;
const verdicts = [];

for (const slug of gone.sort()) {
  const left = bodyLines(read(parentRoot, parent.get(slug)));
  const ranked = [];
  for (const candidate of added) {
    const right = bodyLines(read(childRoot, child.get(candidate)));
    const evidence = {
      content: contentScore(left.lines, right.lines),
      stem: stemScore(slug, candidate),
      path: pathScore(slug, candidate),
      title: titleScore(left.title, right.title)
    };
    const score = 0.6 * evidence.content + 0.2 * evidence.stem + 0.15 * evidence.path + 0.05 * evidence.title;
    ranked.push({ candidate, score, evidence, disqualified: false });
  }
  // The hard disqualifier, applied before any ranking is trusted: a slug the parent already served
  // cannot be where this one was renamed to, because the two pages coexisted. It stays offerable as a
  // `replacedBy`, which is what turns an ambiguous case into an answerable question.
  for (const candidate of shared) {
    const right = bodyLines(read(childRoot, child.get(candidate)));
    const evidence = {
      content: contentScore(left.lines, right.lines),
      stem: stemScore(slug, candidate),
      path: pathScore(slug, candidate),
      title: titleScore(left.title, right.title)
    };
    const score = 0.6 * evidence.content + 0.2 * evidence.stem + 0.15 * evidence.path + 0.05 * evidence.title;
    if (score >= ASK || evidence.stem >= 0.7) ranked.push({ candidate, score, evidence, disqualified: true });
  }
  ranked.sort((a, b) => b.score - a.score);

  const eligible = ranked.filter(r => !r.disqualified);
  const best = eligible[0],
    second = eligible[1];
  let verdict;
  // A body that matches line for line, against a candidate no other candidate comes close to, is the
  // strongest evidence available — stronger than any filename. Without this branch a page that moved
  // into a new directory AND was renamed needs a human for no reason: on the measured corpus,
  // mint/configurations/customization -> customization/custom-json-files is 397 lines on both sides
  // with an identical body, and scores 0.700 purely because the stem changed.
  if (best && best.evidence.content >= 0.95 && (!second || second.evidence.content < 0.5)) verdict = "rename (auto, identical body)";
  else if (best && best.score >= ACCEPT && (!second || best.score - second.score >= MARGIN)) verdict = "rename (auto)";
  else if (best && best.score >= ACCEPT) verdict = "ask (margin too small)";
  else if (best && best.score >= ASK) verdict = "ask (moderate)";
  else if (ranked.some(r => r.disqualified && (r.score >= ASK || r.evidence.stem >= 0.7))) verdict = "ask (replacedBy?)";
  else verdict = "tombstone (silent)";

  verdicts.push({ slug, verdict, best, ranked: ranked.slice(0, 3) });
  const size = read(parentRoot, parent.get(slug)).length;
  console.log(`${slug}  [${size} B]  ->  ${verdict}`);
  for (const r of ranked.slice(0, 3)) {
    const e = r.evidence;
    console.log(`    ${r.score.toFixed(3)}  ${r.disqualified ? "DISQUALIFIED " : "             "}${r.candidate}`);
    console.log(`           content ${e.content.toFixed(2)} stem ${e.stem.toFixed(2)} path ${e.path.toFixed(2)} title ${e.title.toFixed(2)}`);
  }
  console.log();
}

console.log("=== summary ===");
for (const kind of ["rename (auto)", "rename (auto, identical body)", "tombstone (silent)", "ask (replacedBy?)", "ask (moderate)", "ask (margin too small)"]) {
  const hits = verdicts.filter(v => v.verdict === kind);
  if (hits.length > 0) console.log(`${hits.length}  ${kind}: ${hits.map(v => v.slug).join(", ")}`);
}
