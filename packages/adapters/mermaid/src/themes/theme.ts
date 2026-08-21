/**
 * A theme is data, and the renderer reads nothing else. No colour, radius or font size is written
 * anywhere under `render/` — the moment one is, a second theme becomes a fork of the first.
 *
 * Colours are declared twice, light and dark, and both are emitted as fallbacks behind CSS custom
 * properties. That is what lets a documentation site override the palette from its own stylesheet
 * while a bare SVG opened from disk still looks right in either scheme.
 */

import type { SemanticNodeType } from "../model/semantic.js";

/**
 * The custom properties the emitted SVG reads. Fixed names: a site sets them once, for every diagram.
 *
 * Every one of these is used by a rule the renderer emits, and a test asserts it. A token that is
 * advertised here and referenced nowhere is a promise the package does not keep — a site would set it
 * and see nothing change.
 */
export const CSS_VARIABLES = {
  bg: "--docs-overlay-diagram-bg",
  fg: "--docs-overlay-diagram-fg",
  muted: "--docs-overlay-diagram-muted",
  accent: "--docs-overlay-diagram-accent",
  nodeBg: "--docs-overlay-diagram-node-bg",
  nodeBorder: "--docs-overlay-diagram-node-border",
  groupBg: "--docs-overlay-diagram-group-bg",
  groupBorder: "--docs-overlay-diagram-group-border",
  edge: "--docs-overlay-diagram-edge"
} as const;

export type ColorToken = keyof typeof CSS_VARIABLES;

export type ThemeColors = Readonly<Record<ColorToken, string>>;

/**
 * A soft drop shadow, emitted as an SVG filter. Optional because a flat theme must not pay for a
 * `<filter>` it never references, and because a shadow is the one decoration that costs rendering
 * time in a browser rather than only bytes.
 */
export interface ShadowTheme {
  readonly dy: number;
  readonly blur: number;
  readonly opacity: number;
}

/**
 * A tinted rounded square behind the icon. It reads as a small badge rather than a loose glyph, which
 * is most of what separates an illustrated node from a plain one — and it changes the node's width, so
 * the layout has to know about it too.
 */
export interface IconPlateTheme {
  readonly radius: number;
  readonly opacity: number;
  readonly padding: number;
}

export interface NodeTheme {
  readonly paddingX: number;
  readonly paddingY: number;
  readonly minWidth: number;
  readonly minHeight: number;
  /** Where a label starts wrapping. Boxes stay comparable in width instead of one growing to fit a sentence. */
  readonly maxLabelWidth: number;
  readonly cornerRadius: number;
  readonly borderWidth: number;
  readonly iconSize: number;
  readonly iconGap: number;
  /** An `architecture-beta` junction: a dot, drawn at this radius. */
  readonly junctionRadius: number;
  readonly shadow?: ShadowTheme | undefined;
  readonly iconPlate?: IconPlateTheme | undefined;
}

export interface EdgeTheme {
  readonly width: number;
  readonly dashArray: string;
  readonly thickWidth: number;
  readonly arrowSize: number;
  readonly labelPaddingX: number;
  readonly labelPaddingY: number;
  /** Radius of the quarter-turn where a route bends. 0 draws a corner. */
  readonly bendRadius: number;
}

export interface GroupTheme {
  readonly padding: number;
  readonly headerHeight: number;
  readonly cornerRadius: number;
  readonly borderWidth: number;
  readonly dashArray: string;
}

export interface TextTheme {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly edgeFontSize: number;
  readonly groupFontSize: number;
  readonly fontWeight: number;
}

export interface SpacingTheme {
  /** Between siblings on one rank. */
  readonly nodeGap: number;
  /** Between ranks — dagre's `ranksep`, and the grid's column gap. */
  readonly rankGap: number;
  readonly margin: number;
}

export interface SemanticNodeTheme {
  /** Fallback colour for the accent bar and the icon of this type. */
  readonly accent: string;
  /** Registry name used when no rule and no source stated one. */
  readonly icon?: string | undefined;
}

export interface DiagramTheme {
  readonly name: string;
  readonly colors: ThemeColors;
  readonly darkColors: ThemeColors;
  readonly node: NodeTheme;
  readonly edge: EdgeTheme;
  readonly group: GroupTheme;
  readonly text: TextTheme;
  readonly spacing: SpacingTheme;
  readonly semanticTypes: Readonly<Record<SemanticNodeType, SemanticNodeTheme>>;
}

/** `var(--…, fallback)`: the site wins, the fallback keeps a standalone SVG readable. */
export function token(name: ColorToken, colors: ThemeColors): string {
  return `var(${CSS_VARIABLES[name]}, ${colors[name]})`;
}
