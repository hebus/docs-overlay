/**
 * Theme resolution. `minimal` is still unwritten and deliberately not named here: a name that resolved
 * to something else would ship the wrong look and say nothing about it.
 */

import { MermaidError } from "../errors.js";
import { illustratedTheme } from "./illustrated.js";
import { technicalTheme } from "./technical.js";
import type { DiagramTheme } from "./theme.js";

export type DiagramThemeName = "technical" | "illustrated";

const THEMES: Readonly<Record<DiagramThemeName, DiagramTheme>> = { technical: technicalTheme, illustrated: illustratedTheme };

export function resolveTheme(theme: DiagramThemeName | DiagramTheme | undefined): DiagramTheme {
  if (theme === undefined) return technicalTheme;
  if (typeof theme !== "string") return theme;

  // Indexed as a plain string: the parameter type keeps honest callers right, and this keeps the check
  // real for a JavaScript one who asks for a theme that does not exist.
  const found: DiagramTheme | undefined = (THEMES as Readonly<Record<string, DiagramTheme>>)[theme];
  if (found === undefined) {
    throw new MermaidError("unknown-theme", `There is no theme called \`${theme}\`. Available: ${Object.keys(THEMES).join(", ")}.`);
  }
  return found;
}
