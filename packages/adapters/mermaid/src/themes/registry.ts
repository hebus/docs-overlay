/**
 * Theme resolution. Only `technical` ships in this first cut — `minimal` and `illustrated` are
 * design work, and naming them here before their files exist would only let a caller ask for
 * something that silently falls back to something else.
 */

import { MermaidError } from "../errors.js";
import type { DiagramTheme } from "./theme.js";
import { technicalTheme } from "./technical.js";

export type DiagramThemeName = "technical";

const THEMES: Readonly<Record<DiagramThemeName, DiagramTheme>> = { technical: technicalTheme };

export function resolveTheme(theme: DiagramThemeName | DiagramTheme | undefined): DiagramTheme {
  if (theme === undefined) return technicalTheme;
  if (typeof theme !== "string") return theme;

  // Indexed as a plain string: the parameter type keeps honest callers right, and this keeps the
  // check real for a JavaScript one who passes `"illustrated"` before that theme ships.
  const found: DiagramTheme | undefined = (THEMES as Readonly<Record<string, DiagramTheme>>)[theme];
  if (found === undefined) {
    throw new MermaidError("unknown-theme", `There is no theme called \`${theme}\`. Available: ${Object.keys(THEMES).join(", ")}.`);
  }
  return found;
}
