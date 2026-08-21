/**
 * One error class, not five. The engine next door reports through a union of string-literal codes
 * with a JSDoc per member (`docs-overlay`'s `DiagnosticCode`), and callers switch on the code; five
 * classes would only make `instanceof` the discriminator and lose the enumeration.
 *
 * A rendering pipeline does have to fail, though — an unparsable diagram has no SVG — so unlike the
 * engine this throws rather than collecting diagnostics. `RenderOptions.fallback` and
 * `ParseOptions.tolerant` are the two ways to ask it not to.
 */

import type { MermaidDiagramType } from "./model/diagram.js";

export type DiagramErrorCode =
  /** The source is empty, or holds nothing but comments and directives. */
  | "empty-source"
  /** The diagram type was recognised but this package has no parser for it. */
  | "unsupported-diagram-type"
  /** The first significant line matches no known diagram keyword. */
  | "unknown-diagram-type"
  /** A flowchart line could not be parsed. `tolerant` skips it instead. */
  | "flowchart-syntax"
  /** `@mermaid-js/parser` could not be loaded — it is a dependency, so this means a broken install. */
  | "parser-unavailable"
  /** `@mermaid-js/parser` rejected the source. Its own message is appended. */
  | "architecture-syntax"
  /** An edge names an id that no service, group or junction declares. */
  | "unknown-edge-endpoint"
  /** A group declares itself inside a group that does not exist, or inside itself. */
  | "group-cycle"
  /** No layout engine is registered for this diagram type. */
  | "layout-unavailable"
  /** A registered icon carries script, an event handler, or a `<foreignObject>`. */
  | "unsafe-icon"
  /** The requested theme name is not registered. */
  | "unknown-theme";

export interface MermaidErrorDetails {
  readonly diagramType?: MermaidDiagramType | undefined;
  /** 1-based, when the failure can be traced to a line of source. */
  readonly line?: number | undefined;
  readonly cause?: unknown;
}

export class MermaidError extends Error {
  readonly code: DiagramErrorCode;
  readonly diagramType: MermaidDiagramType | undefined;
  readonly line: number | undefined;

  constructor(code: DiagramErrorCode, message: string, details: MermaidErrorDetails = {}) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = "MermaidError";
    this.code = code;
    this.diagramType = details.diagramType;
    this.line = details.line;
  }
}

/** Narrows without `instanceof`, which fails across duplicated copies of the package in a tree. */
export function isMermaidError(value: unknown): value is MermaidError {
  return value instanceof Error && (value as { code?: unknown }).code !== undefined && value.name === "MermaidError";
}
