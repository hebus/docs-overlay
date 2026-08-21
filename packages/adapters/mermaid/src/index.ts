/**
 * `docs-overlay-mermaid` — Mermaid in, a modern technical SVG out, with no DOM, no network and no
 * randomness anywhere in between.
 *
 * The public surface is deliberately small: one facade and the four stages it is made of, so an
 * integrator can take the whole pipeline or step into the middle of it — reusing the semantic model
 * to drive something that is not SVG at all, which is the case the renderer seam exists for.
 *
 * Everything is async because parsing is: `architecture-beta` goes through Mermaid's Langium grammar,
 * which returns a promise. Only the facade and the parser are; enrichment, layout and rendering are
 * synchronous pure functions, and they are the three that are worth testing exhaustively.
 */

import { layoutDiagram } from "./layout/layout.js";
import { parseMermaid } from "./parser/registry.js";
import type { RenderOptions, RenderResult } from "./render/renderer.js";
import { renderSvg } from "./render/svg/render.js";
import { enrichMermaid } from "./semantic/enrich.js";

/**
 * Bump this when the emitted SVG changes for the same input. It is part of every cache key, so a
 * consumer holding a warm cache across an upgrade gets the new output instead of last version's.
 */
export const RENDERER_VERSION = 1;

/**
 * Joins the parts of a cache key. A NUL can occur in neither a theme name nor a Mermaid source, so no
 * two different sets of parts can concatenate into the same key — which a space or a dash cannot
 * promise. Written as an escape: a raw NUL in a source file makes git treat it as binary.
 */
const SEPARATOR = "\u0000";

/**
 * Parse, enrich, lay out, render. No logic of its own — that is the point: every stage stays reachable
 * and replaceable, and this is only the convenient order to call them in.
 */
export async function renderMermaid(source: string, options: RenderOptions = {}): Promise<RenderResult> {
  const key = cacheKey(source, options);
  const cached = options.cache?.get(key);
  if (cached !== undefined) return cached;

  try {
    const diagram = await parseMermaid(source, { tolerant: options.tolerant });
    const semantic = enrichMermaid(diagram, options.semantic);
    const layout = layoutDiagram(semantic, { theme: options.theme, measureText: options.measureText });
    const result = renderSvg(layout, options);
    options.cache?.set(key, result);
    return result;
  } catch (error) {
    // A fallback is the caller saying "show something rather than fail". Without one, the error is
    // theirs to handle: silently swallowing it would hide a typo in a diagram forever.
    if (options.fallback !== undefined) return options.fallback.render(source);
    throw error;
  }
}

/**
 * Everything that changes the output. Rules are functions, so their *source* is what gets hashed —
 * unusual, but it is the only property of a closure that is both stable across runs and sensitive to
 * an edit, and a key that ignored the rules would serve a stale diagram after one was added.
 */
export function cacheKey(source: string, options: RenderOptions = {}): string {
  const theme = typeof options.theme === "string" ? options.theme : (options.theme?.name ?? "technical");
  const rules = (options.semantic?.rules ?? []).map(rule => `${rule.type}:${rule.icon ?? ""}:${rule.match.toString()}`).join("|");
  return [RENDERER_VERSION, theme, options.semantic?.disableDefaults === true ? "no-defaults" : "defaults", rules, source].join(SEPARATOR);
}

export { describe as describeDiagram } from "./accessibility/describe.js";
export { detectDiagramType, significantLine } from "./detect-type.js";
export { isMermaidError, MermaidError } from "./errors.js";
export { assertSafeIcon, createIconRegistry, defaultIconRegistry, extendIconRegistry } from "./icons/registry.js";
export { defaultIcons } from "./icons/default-icons.js";
export { layoutDiagram } from "./layout/layout.js";
export { estimateTextWidth, measureLabel, wrapText } from "./layout/measure-text.js";
export { parseMermaid, parserFor } from "./parser/registry.js";
export { diagramStylesheet, renderSvg, scopeOf } from "./render/svg/render.js";
export { escapeSvgText } from "./render/svg/escape.js";
export { defaultRules } from "./semantic/default-rules.js";
export { enrichMermaid } from "./semantic/enrich.js";
export { resolveTheme } from "./themes/registry.js";
export { illustratedTheme } from "./themes/illustrated.js";
export { minimalTheme } from "./themes/minimal.js";
export { technicalTheme } from "./themes/technical.js";
export { CSS_VARIABLES } from "./themes/theme.js";

export type { AccessibilityOptions, Described } from "./accessibility/describe.js";
export type { DiagramErrorCode, MermaidErrorDetails } from "./errors.js";
export type { IconDefinition, IconRegistry } from "./icons/registry.js";
export type { LayoutOptions } from "./layout/layout.js";
export type { MeasureText } from "./layout/measure-text.js";
export type {
  AlignmentKind,
  DiagramAlignment,
  DiagramDirection,
  EdgeArrow,
  EdgeSide,
  EdgeType,
  MermaidDiagram,
  MermaidDiagramType,
  MermaidEdge,
  MermaidGroup,
  MermaidNode,
  NodeShape
} from "./model/diagram.js";
export type { Box, LayoutEdge, LayoutEdgeLabel, LayoutGroup, LayoutNode, LayoutResult, MeasuredLabel, Point } from "./model/layout.js";
export type { SemanticDiagram, SemanticEdge, SemanticGroup, SemanticNode, SemanticNodeType, SemanticOptions, SemanticRule } from "./model/semantic.js";
export type { DiagramParser, ParseOptions } from "./parser/registry.js";
export type { DiagramCache, DiagramRenderer, FallbackRenderer, RenderOptions, RenderResult } from "./render/renderer.js";
export type { DiagramThemeName } from "./themes/registry.js";
export type {
  ColorToken,
  DiagramTheme,
  EdgeTheme,
  GroupTheme,
  IconPlateTheme,
  NodeTheme,
  SemanticNodeTheme,
  ShadowTheme,
  SpacingTheme,
  TextTheme,
  ThemeColors
} from "./themes/theme.js";
