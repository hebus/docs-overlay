/**
 * Which parser to use, decided without parsing. Everything that can legally precede the first
 * significant line — YAML frontmatter, `%%{init}%%` directives, `%%` comments, blank lines — is
 * skipped, then the keyword is read.
 *
 * Deliberately not a parse: a diagram this package cannot render must still be *identified*, so the
 * caller can hand it to a fallback renderer instead of getting "unknown".
 */

import type { MermaidDiagramType } from "./model/diagram.js";

/** Longest first: `stateDiagram-v2` must not be read as `stateDiagram`, and `graph` is a prefix of nothing. */
const KEYWORDS: readonly (readonly [string, MermaidDiagramType])[] = [
  ["architecture-beta", "architecture"],
  ["architecture", "architecture"],
  ["stateDiagram-v2", "state"],
  ["stateDiagram", "state"],
  ["sequenceDiagram", "sequence"],
  ["classDiagram-v2", "class"],
  ["classDiagram", "class"],
  ["erDiagram", "er"],
  ["flowchart-elk", "flowchart"],
  ["flowchart", "flowchart"],
  ["graph", "flowchart"]
];

/**
 * The first line that carries a diagram keyword, or `undefined` when there is none.
 *
 * Frontmatter is only skipped when the source *opens* with it, because `---` is also a legal
 * flowchart edge and skipping to the next `---` would swallow the diagram.
 */
export function significantLine(source: string): { readonly text: string; readonly line: number } | undefined {
  const lines = source.split(/\r?\n/);
  let index = 0;

  if (lines[0]?.trim() === "---") {
    index = 1;
    while (index < lines.length && lines[index]?.trim() !== "---") index += 1;
    index += 1;
  }

  for (; index < lines.length; index += 1) {
    const text = (lines[index] ?? "").trim();
    if (text === "" || text.startsWith("%%")) continue;
    return { text, line: index + 1 };
  }

  return undefined;
}

export function detectDiagramType(source: string): MermaidDiagramType {
  const first = significantLine(source);
  if (first === undefined) return "unknown";

  for (const entry of KEYWORDS) {
    const [keyword, type] = entry;
    if (!first.text.startsWith(keyword)) continue;
    // `flowchartish` is not `flowchart`: the keyword has to end the word.
    const next = first.text.charAt(keyword.length);
    if (next === "" || next === " " || next === "\t" || next === ";") return type;
  }

  return "unknown";
}
