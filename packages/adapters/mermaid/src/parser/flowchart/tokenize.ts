/**
 * A tokenizer for the flowchart subset, written by hand because `@mermaid-js/parser` does not cover
 * flowcharts: its `parse()` overloads are `info, packet, pie, treeView, architecture, gitGraph,
 * eventmodeling, radar, railroad*, treemap, wardley, cynefin`. Flowcharts still run on the JISON
 * grammar inside the `mermaid` package, which needs a DOM and would drag d3, cytoscape and katex in.
 *
 * So this covers a *documented subset* — see the README — and says so loudly when it meets something
 * outside it, rather than guessing. Scanning is stateful (`expect`) rather than regex-per-line,
 * because `o` and `x` are both link tips and legal node ids and only position tells them apart.
 */

import { MermaidError } from "../../errors.js";
import type { EdgeArrow, EdgeType, NodeShape } from "../../model/diagram.js";

export interface NodeToken {
  readonly kind: "node";
  readonly id: string;
  readonly label?: string | undefined;
  readonly shape?: NodeShape | undefined;
  readonly classNames: readonly string[];
}

export interface EdgeToken {
  readonly kind: "edge";
  readonly type: EdgeType;
  readonly sourceArrow: EdgeArrow;
  readonly targetArrow: EdgeArrow;
  readonly label?: string | undefined;
}

/** `A & B --> C`: the ampersand fans one link out over several endpoints. */
export interface AmpToken {
  readonly kind: "amp";
}

export type StatementToken = NodeToken | EdgeToken | AmpToken;

export interface Statement {
  readonly text: string;
  /** 1-based, so an error can point at the line the author wrote. */
  readonly line: number;
}

/** Openers longest-first: `[(` is a cylinder and must never be read as a `[` holding a `(`. */
const SHAPES: readonly (readonly [string, string, NodeShape])[] = [
  ["((", "))", "circle"],
  ["([", "])", "stadium"],
  ["[[", "]]", "subroutine"],
  ["[(", ")]", "cylinder"],
  ["{{", "}}", "hexagon"],
  ["[", "]", "rectangle"],
  ["(", ")", "rounded"],
  ["{", "}", "rhombus"]
];

/** Word characters plus a dot, plus anything above ASCII so accented and CJK ids work. */
const ID = /[\w.À-￿]/;
/** The same without the dot, for deciding whether a hyphen continues an id or starts a link. */
const ID_WORD = /[\wÀ-￿]/;
const LINK_BODY = /[-=.]/;
const ARROW_TIP: Readonly<Record<string, EdgeArrow>> = { ">": "arrow", o: "circle", x: "cross" };

const OPENERS = "([{";
const CLOSERS = ")]}";

/**
 * One line to its statements: a `%%` comment cut off, `;` treated as a line break the way Mermaid
 * does. Both have to respect quotes *and* bracket depth, which is not a nicety —
 * `A["Tom &amp; Jerry"]` holds a semicolon inside its label, and splitting blindly on `;` cut the
 * label in half and left the rest of the line as a second, unparsable statement. `A["100%% done"]`
 * is the same trap for the comment.
 */
export function splitLine(line: string): readonly string[] {
  const parts: string[] = [];
  let quoted = false;
  let depth = 0;
  let start = 0;

  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index);

    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;

    if (OPENERS.includes(char)) {
      depth += 1;
      continue;
    }
    if (CLOSERS.includes(char)) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) continue;

    if (char === "%" && line.charAt(index + 1) === "%") {
      parts.push(line.slice(start, index));
      return parts;
    }
    if (char === ";") {
      parts.push(line.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(line.slice(start));
  return parts;
}

/**
 * Source to statements. Line numbers survive the split, so a diagnostic can still name the line an
 * author wrote rather than a position in a normalised stream.
 */
export function splitStatements(source: string): readonly Statement[] {
  const lines = source.split(/\r?\n/);
  const statements: Statement[] = [];
  let index = 0;

  // Only when the source *opens* with it: `---` is also a legal link, and scanning ahead for the
  // closing fence would swallow the diagram.
  if (lines[0]?.trim() === "---") {
    index = 1;
    while (index < lines.length && lines[index]?.trim() !== "---") index += 1;
    index += 1;
  }

  for (; index < lines.length; index += 1) {
    for (const part of splitLine(lines[index] ?? "")) {
      const text = part.trim();
      if (text !== "") statements.push({ text, line: index + 1 });
    }
  }

  return statements;
}

/** Reads a label, honouring quotes so a closing bracket inside `"…"` does not end it early. */
function readLabel(text: string, start: number, closer: string, line: number): { readonly label: string; readonly end: number } {
  let index = start;

  if (text.charAt(index) === '"') {
    index += 1;
    const close = text.indexOf('"', index);
    if (close === -1) throw new MermaidError("flowchart-syntax", `Unterminated quoted label on line ${line}.`, { diagramType: "flowchart", line });
    const after = close + 1;
    if (!text.startsWith(closer, after)) {
      throw new MermaidError("flowchart-syntax", `Expected \`${closer}\` after the quoted label on line ${line}.`, { diagramType: "flowchart", line });
    }
    return { label: text.slice(index, close), end: after + closer.length };
  }

  const close = text.indexOf(closer, index);
  if (close === -1) throw new MermaidError("flowchart-syntax", `Missing \`${closer}\` on line ${line}.`, { diagramType: "flowchart", line });
  return { label: text.slice(index, close).trim(), end: close + closer.length };
}

function readNode(text: string, start: number, line: number): { readonly token: NodeToken; readonly end: number } {
  let index = start;
  /*
   * `user-service --> api-gateway` is idiomatic Mermaid, and it used to be a syntax error here: the id
   * stopped at the hyphen and the rest of the word was read as a broken link.
   *
   * A hyphen continues the id when a word character follows it. Two in a row cannot, which is what keeps
   * `A-->B` from being read as an id called `A--`; and the following character must be a word character
   * rather than any id character, because a dot is one and `x-.->y` is a dotted link, not an id `x-.`.
   */
  while (index < text.length) {
    const char = text.charAt(index);
    if (ID.test(char)) {
      index += 1;
      continue;
    }
    if (char === "-" && ID_WORD.test(text.charAt(index + 1))) {
      index += 1;
      continue;
    }
    break;
  }
  const id = text.slice(start, index);
  if (id === "") {
    throw new MermaidError("flowchart-syntax", `Expected a node id on line ${line}, found \`${text.slice(start).trim() || "end of line"}\`.`, {
      diagramType: "flowchart",
      line
    });
  }

  let label: string | undefined;
  let shape: NodeShape | undefined;
  for (const entry of SHAPES) {
    const [opener, closer, candidate] = entry;
    if (!text.startsWith(opener, index)) continue;
    const read = readLabel(text, index + opener.length, closer, line);
    label = read.label;
    shape = candidate;
    index = read.end;
    break;
  }

  const classNames: string[] = [];
  while (text.startsWith(":::", index)) {
    index += 3;
    const from = index;
    while (index < text.length && ID.test(text.charAt(index))) index += 1;
    const name = text.slice(from, index);
    if (name === "") throw new MermaidError("flowchart-syntax", `Expected a class name after \`:::\` on line ${line}.`, { diagramType: "flowchart", line });
    classNames.push(name);
  }

  return { token: { kind: "node", id, label, shape, classNames }, end: index };
}

interface InlineLabel {
  readonly label: string;
  readonly body: string;
  readonly tip: string;
  readonly end: number;
}

/**
 * The bodies that *open* a labeled link rather than being one. This is the disambiguator Mermaid's own
 * grammar uses — a two-character body with no tip is `START_LINK`, anything longer or tipped is a
 * complete `LINK` — and it settles the one genuine ambiguity in the syntax:
 *
 *     A --- B --- C      three dashes: complete links, so a three-node chain
 *     A -- text --> B    two dashes, no tip: opens a label, closed by the next link
 *
 * The rule matters because both readings are otherwise legal, and getting it backwards silently turns
 * the middle node of a chain into an edge label.
 */
const LABEL_OPENERS: readonly string[] = ["--", "-.", "=="];

/**
 * Reads the text of a labeled link and the link that closes it.
 *
 * Scanned by hand rather than matched with a regex, because a regex backtracks and backtracking is
 * exactly what breaks this: `[-=.]{2,}` will happily give back its last dash so a following lookahead
 * can match the dash itself. A run of one body character is skipped rather than treated as the
 * closing link, which is what keeps a hyphen inside a label — `well-known` — from ending it.
 */
function findInlineLabel(text: string, from: number): InlineLabel | undefined {
  for (let index = from; index < text.length; index += 1) {
    // A quoted label is opaque: without this, the `--` inside `-- "a--b" -->` closes the link early and
    // the remainder becomes a phantom node. Quoting is Mermaid's own escape hatch for a label with
    // special characters in it, so it has to work here.
    if (text.charAt(index) === '"') {
      const close = text.indexOf('"', index + 1);
      if (close === -1) break;
      index = close;
      continue;
    }
    if (!LINK_BODY.test(text.charAt(index))) continue;

    let bodyEnd = index;
    while (bodyEnd < text.length && LINK_BODY.test(text.charAt(bodyEnd))) bodyEnd += 1;
    if (bodyEnd - index < 2) {
      index = bodyEnd - 1;
      continue;
    }

    let end = bodyEnd;
    let tip = "";
    if (ARROW_TIP[text.charAt(end)] !== undefined) {
      tip = text.charAt(end);
      end += 1;
    }

    return { label: unquote(text.slice(from, index).trim()), body: text.slice(index, bodyEnd), tip, end };
  }

  return undefined;
}

function unquote(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

/** Reads one link: an optional leading tip, a body of dashes, dots or equals, and an optional tip. */
function readEdge(text: string, start: number, line: number): { readonly token: EdgeToken; readonly end: number } {
  let index = start;

  let sourceArrow: EdgeArrow = "none";
  const lead = text.charAt(index);
  if ((lead === "<" || lead === "o" || lead === "x") && LINK_BODY.test(text.charAt(index + 1))) {
    sourceArrow = lead === "<" ? "arrow" : (ARROW_TIP[lead] ?? "none");
    index += 1;
  }

  const bodyStart = index;
  while (index < text.length && LINK_BODY.test(text.charAt(index))) index += 1;
  let body = text.slice(bodyStart, index);
  if (body.length < 2) {
    throw new MermaidError("flowchart-syntax", `Expected a link on line ${line}, found \`${text.slice(start).trim()}\`.`, { diagramType: "flowchart", line });
  }

  let targetArrow: EdgeArrow = "none";
  let label: string | undefined;

  const tip = ARROW_TIP[text.charAt(index)];
  if (tip !== undefined) {
    targetArrow = tip;
    index += 1;
  } else if (LABEL_OPENERS.includes(body)) {
    const inline = findInlineLabel(text, index);
    if (inline === undefined) {
      throw new MermaidError(
        "flowchart-syntax",
        `\`${body}\` on line ${line} opens a labeled link that is never closed. Write \`--\` … \`-->\`, or \`---\` for a plain link.`,
        {
          diagramType: "flowchart",
          line
        }
      );
    }
    label = inline.label;
    body += inline.body;
    targetArrow = ARROW_TIP[inline.tip] ?? "none";
    index = inline.end;
  }

  if (text.charAt(index) === "|") {
    const read = readLabel(text, index + 1, "|", line);
    label = read.label;
    index = read.end;
  }

  const type: EdgeType = body.includes(".") ? "dotted" : body.includes("=") ? "thick" : "solid";
  return { token: { kind: "edge", type, sourceArrow, targetArrow, label }, end: index };
}

/**
 * One statement to its tokens. `expect` is the whole trick: the same `o` is a link tip after a node
 * and a node id after a link, and no amount of lookahead settles that — only position does.
 */
export function tokenizeStatement(statement: Statement): readonly StatementToken[] {
  const { text, line } = statement;
  const tokens: StatementToken[] = [];
  let expect: "node" | "edge" = "node";
  let index = 0;

  while (index < text.length) {
    const char = text.charAt(index);

    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }

    if (char === "&") {
      tokens.push({ kind: "amp" });
      expect = "node";
      index += 1;
      continue;
    }

    if (expect === "node") {
      const read = readNode(text, index, line);
      tokens.push(read.token);
      index = read.end;
      expect = "edge";
      continue;
    }

    const read = readEdge(text, index, line);
    tokens.push(read.token);
    index = read.end;
    expect = "node";
  }

  if (expect === "node" && tokens.length > 0) {
    throw new MermaidError("flowchart-syntax", `Line ${line} ends with a link that goes nowhere.`, { diagramType: "flowchart", line });
  }

  return tokens;
}
