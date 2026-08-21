/**
 * Statements to the normalized model. There is no separate flowchart AST between the two: the
 * tokenizer's tokens already *are* that AST, and a third representation would be ceremony rather
 * than a seam — nothing would ever be swapped out at that level. The seam that matters is
 * `DiagramParser`, and it sits one level up.
 *
 * What this adds on top of the tokenizer is everything statement-shaped: the header, `subgraph`
 * nesting, `classDef`/`class`, and the statements Mermaid accepts that mean nothing without a
 * browser (`click`, `style`, `linkStyle`) and are therefore read and dropped.
 */

import { MermaidError } from "../../errors.js";
import type { DiagramDirection, MermaidDiagram, MermaidEdge, MermaidGroup, MermaidNode, NodeShape } from "../../model/diagram.js";
import type { Statement } from "./tokenize.js";
import { splitStatements, tokenizeStatement } from "./tokenize.js";

export interface FlowchartParseOptions {
  /**
   * Skip a statement that fails to parse instead of throwing. This is what makes a half-typed
   * diagram — the one a Markdown stream has only partly delivered — render as far as it goes
   * rather than taking the page down.
   */
  readonly tolerant?: boolean | undefined;
}

const HEADER = /^(?:flowchart|flowchart-elk|graph)(?:\s+(TB|TD|BT|RL|LR))?$/;
const DIRECTIONS: Readonly<Record<string, DiagramDirection>> = { TB: "TB", TD: "TB", BT: "BT", RL: "RL", LR: "LR" };

/** Read, then dropped: they style or wire up a diagram a browser would render, and there is none here. */
const IGNORED = /^(?:style|linkStyle|classDef|click|direction|accTitle|accDescr)\b/;

interface NodeDraft {
  id: string;
  label: string;
  shape: NodeShape;
  classNames: string[];
  group: string | undefined;
}

interface GroupDraft {
  id: string;
  label: string | undefined;
  parent: string | undefined;
  children: string[];
}

/**
 * `subgraph id [Title]`, `subgraph id["Title"]`, `subgraph Title`. Mermaid lets the id double as the
 * title when no bracket follows, so a one-word subgraph needs no repetition.
 */
function readSubgraph(text: string, line: number): { readonly id: string; readonly label: string | undefined } {
  const rest = text.slice("subgraph".length).trim();
  if (rest === "") throw new MermaidError("flowchart-syntax", `\`subgraph\` needs a name on line ${line}.`, { diagramType: "flowchart", line });

  const bracket = rest.indexOf("[");
  if (bracket === -1) return { id: rest, label: rest };

  const close = rest.lastIndexOf("]");
  if (close < bracket)
    throw new MermaidError("flowchart-syntax", `Missing \`]\` after the subgraph title on line ${line}.`, { diagramType: "flowchart", line });

  const id = rest.slice(0, bracket).trim();
  const raw = rest.slice(bracket + 1, close).trim();
  const label = raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2 ? raw.slice(1, -1) : raw;
  return { id: id === "" ? label : id, label };
}

/** `class a,b highlight` — the class names themselves stay opaque; only the theme reads them. */
function readClass(text: string, line: number): { readonly ids: readonly string[]; readonly names: readonly string[] } {
  const match = /^class\s+(\S+)\s+(\S+)\s*$/.exec(text);
  if (match === null) throw new MermaidError("flowchart-syntax", `Expected \`class <ids> <name>\` on line ${line}.`, { diagramType: "flowchart", line });
  return { ids: (match[1] ?? "").split(",").filter(part => part !== ""), names: (match[2] ?? "").split(",").filter(part => part !== "") };
}

export function parseFlowchart(source: string, options: FlowchartParseOptions = {}): MermaidDiagram {
  const statements = splitStatements(source);
  if (statements.length === 0) throw new MermaidError("empty-source", "The source holds no diagram.", { diagramType: "flowchart" });

  const first = statements[0];
  const header = first === undefined ? null : HEADER.exec(first.text);
  if (first === undefined || header === null) {
    throw new MermaidError("flowchart-syntax", `Expected \`flowchart\` or \`graph\` on line ${first?.line ?? 1}.`, {
      diagramType: "flowchart",
      line: first?.line ?? 1
    });
  }
  const direction = DIRECTIONS[header[1] ?? "TB"] ?? "TB";

  const nodes = new Map<string, NodeDraft>();
  const groups = new Map<string, GroupDraft>();
  const edges: MermaidEdge[] = [];
  const open: string[] = [];

  /** A node belongs to the subgraph it is first *seen* in, declared there or merely referenced. */
  const touch = (id: string, label: string | undefined, shape: NodeShape | undefined, classNames: readonly string[]): void => {
    let draft = nodes.get(id);
    if (draft === undefined) {
      const parent = open[open.length - 1];
      draft = { id, label: id, shape: "rectangle", classNames: [], group: parent };
      nodes.set(id, draft);
      if (parent !== undefined) groups.get(parent)?.children.push(id);
    }
    if (label !== undefined) draft.label = label;
    if (shape !== undefined) draft.shape = shape;
    for (const name of classNames) if (!draft.classNames.includes(name)) draft.classNames.push(name);
  };

  const consume = (statement: Statement): void => {
    const { text, line } = statement;

    if (text.startsWith("subgraph")) {
      const { id, label } = readSubgraph(text, line);
      const parent = open[open.length - 1];
      if (!groups.has(id)) groups.set(id, { id, label, parent, children: [] });
      if (parent !== undefined) groups.get(parent)?.children.push(id);
      open.push(id);
      return;
    }

    if (text === "end") {
      if (open.pop() === undefined) throw new MermaidError("flowchart-syntax", `\`end\` on line ${line} closes nothing.`, { diagramType: "flowchart", line });
      return;
    }

    if (/^class\s/.test(text)) {
      const { ids, names } = readClass(text, line);
      for (const id of ids) touch(id, undefined, undefined, names);
      return;
    }

    if (IGNORED.test(text)) return;

    // A chain: node (& node)* link node (& node)* link …  — every left endpoint links to every
    // right one, which is what `A & B --> C & D` means.
    const tokens = tokenizeStatement(statement);
    let left: string[] = [];
    let pending: string[] = [];
    let link:
      | {
          readonly type: MermaidEdge["type"];
          readonly sourceArrow: MermaidEdge["sourceArrow"];
          readonly targetArrow: MermaidEdge["targetArrow"];
          readonly label: string | undefined;
        }
      | undefined;

    for (const token of tokens) {
      if (token.kind === "amp") continue;

      if (token.kind === "node") {
        touch(token.id, token.label, token.shape, token.classNames);
        pending.push(token.id);
        continue;
      }

      if (pending.length === 0) throw new MermaidError("flowchart-syntax", `A link on line ${line} starts from nothing.`, { diagramType: "flowchart", line });
      if (link !== undefined) {
        for (const source of left)
          for (const target of pending)
            edges.push({ source, target, label: link.label, type: link.type, sourceArrow: link.sourceArrow, targetArrow: link.targetArrow });
      }
      left = pending;
      pending = [];
      link = { type: token.type, sourceArrow: token.sourceArrow, targetArrow: token.targetArrow, label: token.label };
    }

    if (link !== undefined) {
      if (pending.length === 0) throw new MermaidError("flowchart-syntax", `A link on line ${line} goes nowhere.`, { diagramType: "flowchart", line });
      for (const source of left)
        for (const target of pending)
          edges.push({ source, target, label: link.label, type: link.type, sourceArrow: link.sourceArrow, targetArrow: link.targetArrow });
    }
  };

  for (const statement of statements.slice(1)) {
    try {
      consume(statement);
    } catch (error) {
      if (options.tolerant !== true) throw error;
    }
  }

  const declared: readonly MermaidNode[] = [...nodes.values()].map(draft => ({
    id: draft.id,
    label: draft.label,
    shape: draft.shape,
    classNames: draft.classNames,
    group: draft.group
  }));

  const built: readonly MermaidGroup[] = [...groups.values()].map(draft => ({
    id: draft.id,
    label: draft.label,
    parent: draft.parent,
    children: draft.children
  }));

  return { type: "flowchart", direction, nodes: declared, edges, groups: built, alignments: [] };
}
