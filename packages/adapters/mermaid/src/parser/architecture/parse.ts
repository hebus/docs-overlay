/**
 * `architecture-beta`, parsed by Mermaid's own Langium grammar. This is the one diagram type
 * `@mermaid-js/parser` actually covers, so nothing is reimplemented here — and it is the type that
 * gains most from the semantic layer, because its authors already state intent (`service`, `group`,
 * an icon name) instead of drawing boxes.
 *
 * The import is dynamic on purpose. `@mermaid-js/parser` bundles the Langium runtime — a 1.3 MB
 * shared chunk — and a consumer who only renders flowcharts should never pay for it. Making the
 * public API async is the price, and it is the right one: the alternative leaks which parser backs
 * which diagram type into the signature.
 */

import type { Architecture } from "@mermaid-js/parser";
import { MermaidError } from "../../errors.js";

/**
 * The AST members are not exported by `@mermaid-js/parser` — only `Architecture` is; `Service`,
 * `Group`, `Edge` and `Junction` are private `declare interface`s. Indexed access recovers them
 * without naming them, which also means a grammar change surfaces here as a type error rather than
 * as a silently absent field.
 */
export type ArchitectureService = Architecture["services"][number];
export type ArchitectureGroup = Architecture["groups"][number];
export type ArchitectureEdge = Architecture["edges"][number];
export type ArchitectureJunction = Architecture["junctions"][number];
export type ArchitectureAlignment = Architecture["alignments"][number];

export async function parseArchitectureAst(source: string): Promise<Architecture> {
  let parse: (typeof import("@mermaid-js/parser"))["parse"];
  try {
    ({ parse } = await import("@mermaid-js/parser"));
  } catch (error) {
    throw new MermaidError("parser-unavailable", "`@mermaid-js/parser` could not be loaded. It is a dependency, so this usually means a broken install.", {
      diagramType: "architecture",
      cause: error
    });
  }

  try {
    return await parse("architecture", source);
  } catch (error) {
    throw new MermaidError("architecture-syntax", `Mermaid rejected this architecture diagram: ${messageOf(error)}`, {
      diagramType: "architecture",
      cause: error
    });
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
