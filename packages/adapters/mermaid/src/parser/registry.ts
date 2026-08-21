/**
 * The seam. A parser owns one dialect and hands back the normalized model — parsing and normalizing
 * together, because the AST in between is dialect-specific and letting it through the public API
 * would tie every consumer to whichever library happens to back that dialect today.
 *
 * That is also what makes the two very different backends here invisible from the outside: Langium
 * for `architecture-beta`, a hand-written tokenizer for `flowchart`. Adding `sequenceDiagram` later
 * means adding an entry, not touching anything downstream.
 */

import { detectDiagramType } from "../detect-type.js";
import { MermaidError } from "../errors.js";
import type { MermaidDiagram, MermaidDiagramType } from "../model/diagram.js";
import { normalizeArchitecture } from "./architecture/normalize.js";
import { parseArchitectureAst } from "./architecture/parse.js";
import { parseFlowchart } from "./flowchart/parse.js";

export interface ParseOptions {
  /**
   * Skip what cannot be parsed instead of throwing. A Markdown stream delivers a diagram a few lines
   * at a time, and every intermediate state is a syntax error; this is what keeps those harmless.
   */
  readonly tolerant?: boolean | undefined;
}

export interface DiagramParser {
  readonly type: MermaidDiagramType;
  readonly parse: (source: string, options: ParseOptions) => Promise<MermaidDiagram>;
}

const PARSERS: readonly DiagramParser[] = [
  { type: "flowchart", parse: (source, options) => Promise.resolve(parseFlowchart(source, options)) },
  { type: "architecture", parse: async source => normalizeArchitecture(await parseArchitectureAst(source)) }
];

export function parserFor(type: MermaidDiagramType): DiagramParser | undefined {
  return PARSERS.find(parser => parser.type === type);
}

/**
 * Source to normalized model. The two failures are told apart on purpose: a diagram this package
 * cannot render yet is not the same as text that is not a diagram, and only the first is worth
 * handing to a fallback renderer.
 */
export async function parseMermaid(source: string, options: ParseOptions = {}): Promise<MermaidDiagram> {
  const type = detectDiagramType(source);
  if (type === "unknown") {
    throw new MermaidError("unknown-diagram-type", "No Mermaid diagram keyword was found. Expected `flowchart`, `graph` or `architecture-beta`.");
  }

  const parser = parserFor(type);
  if (parser === undefined) {
    throw new MermaidError(
      "unsupported-diagram-type",
      `\`${type}\` diagrams are not supported yet. Mermaid has no standalone parser for them, so each needs its own.`,
      {
        diagramType: type
      }
    );
  }

  return parser.parse(source, options);
}
