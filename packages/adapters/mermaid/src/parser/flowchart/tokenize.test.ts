import { describe, expect, it } from "vitest";
import { MermaidError } from "../../errors.js";
import { splitLine, splitStatements, tokenizeStatement } from "./tokenize.js";
import type { EdgeToken, NodeToken } from "./tokenize.js";

const tokens = (text: string, line = 1): readonly unknown[] => tokenizeStatement({ text, line });
const nodes = (text: string): readonly NodeToken[] => tokens(text).filter((token): token is NodeToken => (token as NodeToken).kind === "node");
const edges = (text: string): readonly EdgeToken[] => tokens(text).filter((token): token is EdgeToken => (token as EdgeToken).kind === "edge");

describe("splitLine", () => {
  it("cuts a comment off the end", () => {
    expect(splitLine("A --> B %% and then")).toEqual(["A --> B "]);
  });

  it("splits on a semicolon", () => {
    expect(splitLine("A --> B; B --> C")).toEqual(["A --> B", " B --> C"]);
  });

  // `A["100% done"]` doubled to `100%%` is real Mermaid, and a blind indexOf would cut the label in
  // half and leave an unbalanced bracket behind.
  it("leaves a percent pair inside a quoted label alone", () => {
    expect(splitLine('A["100%% done"]')).toEqual(['A["100%% done"]']);
  });

  /*
   * The regression that made this bracket-aware as well as quote-aware: an HTML entity inside a label
   * ends in a semicolon, so `A["Tom &amp; Jerry"]` was split through the middle of its own label and
   * the remainder became a second statement that could not parse.
   */
  it("leaves a semicolon inside a label alone", () => {
    expect(splitLine('A["Tom &amp; Jerry"] --> B')).toEqual(['A["Tom &amp; Jerry"] --> B']);
    expect(splitLine("A[Tom &amp; Jerry] --> B")).toEqual(["A[Tom &amp; Jerry] --> B"]);
  });
});

describe("splitStatements", () => {
  it("treats a semicolon as a line break, the way Mermaid does", () => {
    expect(splitStatements("flowchart LR; A --> B").map(statement => statement.text)).toEqual(["flowchart LR", "A --> B"]);
  });

  it("keeps the original line number after splitting", () => {
    expect(splitStatements("flowchart LR\n\nA --> B")).toEqual([
      { text: "flowchart LR", line: 1 },
      { text: "A --> B", line: 3 }
    ]);
  });
});

describe("tokenizeStatement", () => {
  it("reads every shape it supports", () => {
    expect(nodes("r[Rect]").at(0)).toMatchObject({ id: "r", label: "Rect", shape: "rectangle" });
    expect(nodes("ro(Round)").at(0)).toMatchObject({ shape: "rounded" });
    expect(nodes("st([Stadium])").at(0)).toMatchObject({ shape: "stadium" });
    expect(nodes("sub[[Sub]]").at(0)).toMatchObject({ shape: "subroutine" });
    expect(nodes("cyl[(Cyl)]").at(0)).toMatchObject({ shape: "cylinder" });
    expect(nodes("cir((Cir))").at(0)).toMatchObject({ shape: "circle" });
    expect(nodes("rh{Rh}").at(0)).toMatchObject({ shape: "rhombus" });
    expect(nodes("hex{{Hex}}").at(0)).toMatchObject({ shape: "hexagon" });
  });

  // Two-character openers are tried first, so `[(` is a cylinder and never a `[` holding a `(`.
  it("prefers the longer opener", () => {
    expect(nodes("a[(One)]").at(0)).toMatchObject({ shape: "cylinder", label: "One" });
    expect(nodes("a[[One]]").at(0)).toMatchObject({ shape: "subroutine", label: "One" });
  });

  it("keeps a quoted label verbatim, brackets and all", () => {
    expect(nodes('a["a ] b"]').at(0)?.label).toBe("a ] b");
  });

  it("reads every link kind", () => {
    expect(edges("A --> B").at(0)).toMatchObject({ type: "solid", sourceArrow: "none", targetArrow: "arrow" });
    expect(edges("A --- B").at(0)).toMatchObject({ type: "solid", targetArrow: "none" });
    expect(edges("A -.-> B").at(0)).toMatchObject({ type: "dotted", targetArrow: "arrow" });
    expect(edges("A ==> B").at(0)).toMatchObject({ type: "thick", targetArrow: "arrow" });
    expect(edges("A --o B").at(0)).toMatchObject({ targetArrow: "circle" });
    expect(edges("A --x B").at(0)).toMatchObject({ targetArrow: "cross" });
    expect(edges("A <--> B").at(0)).toMatchObject({ sourceArrow: "arrow", targetArrow: "arrow" });
    expect(edges("A o--o B").at(0)).toMatchObject({ sourceArrow: "circle", targetArrow: "circle" });
  });

  // `o` and `x` are link tips and legal node ids both. Only position separates them, which is why the
  // scanner tracks what it expects next instead of matching patterns line-wide.
  it("reads o and x as node ids where a node is expected", () => {
    expect(nodes("o --> x").map(node => node.id)).toEqual(["o", "x"]);
  });

  it("reads both label forms, spaced or not", () => {
    expect(edges("A -->|yes| B").at(0)?.label).toBe("yes");
    expect(edges("A ---|yes| B").at(0)?.label).toBe("yes");
    expect(edges("A-- maybe -->B").at(0)?.label).toBe("maybe");
    expect(edges("A -- maybe --> B").at(0)?.label).toBe("maybe");
    expect(edges("A--maybe-->B").at(0)?.label).toBe("maybe");
    expect(edges("A-. later .->B").at(0)).toMatchObject({ label: "later", type: "dotted" });
    expect(edges("A== heavy ==>B").at(0)).toMatchObject({ label: "heavy", type: "thick" });
  });

  it("keeps a hyphen inside a label from closing it", () => {
    expect(edges("A -- well-known --> B").at(0)?.label).toBe("well-known");
  });

  it("unquotes a quoted link label", () => {
    expect(edges('A -- "a; b" --> B').at(0)?.label).toBe("a; b");
  });

  /*
   * The one genuine ambiguity in the syntax: `A --- B --- C` and `A -- text --> B` are built from the
   * same characters. The decision, taken from Mermaid's own grammar, is the *length of the body*: two
   * characters with no tip opens a label, three or more is a complete link. Getting this backwards
   * silently turns the middle node of a chain into an edge label, which is why it is pinned here.
   */
  it("reads a three-character body as a complete link, so a chain stays a chain", () => {
    expect(nodes("A --- B --- C").map(node => node.id)).toEqual(["A", "B", "C"]);
    expect(edges("A --- B --- C").every(edge => edge.label === undefined)).toBe(true);
    expect(nodes("A --- B --> C").map(node => node.id)).toEqual(["A", "B", "C"]);
  });

  it("reads a two-character body as opening a label", () => {
    expect(nodes("X-- carries ---Y").map(node => node.id)).toEqual(["X", "Y"]);
    expect(edges("X-- carries ---Y").at(0)?.label).toBe("carries");
  });

  // Mermaid rejects `A -- B` too. An error beats reading `B` as a label on a link with no endpoint.
  it("refuses a label opener that is never closed", () => {
    expect(() => tokens("A -- B")).toThrow(/never closed/);
  });

  it("reads class shorthand, repeated", () => {
    expect(nodes("A:::hot:::cold").at(0)?.classNames).toEqual(["hot", "cold"]);
  });

  it("reads the ampersand as its own token", () => {
    expect(tokens("A & B --> C").filter(token => (token as { kind: string }).kind === "amp")).toHaveLength(1);
  });

  it("refuses a statement that ends on a link", () => {
    expect(() => tokens("A -->", 7)).toThrow(MermaidError);
    expect(() => tokens("A -->", 7)).toThrow(/Line 7/);
  });

  it("refuses an unterminated quoted label", () => {
    expect(() => tokens('A["oops]')).toThrow(/Unterminated quoted label/);
  });

  it("refuses a missing closing bracket", () => {
    expect(() => tokens("A[oops")).toThrow(/Missing `\]`/);
  });
});
