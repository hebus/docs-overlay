/**
 * The renderer seam. SVG is the first output, not the only intended one — an Excalidraw scene and a
 * Mermaid round-trip are both layout consumers — and the point of naming the interface now is that
 * adding one must not touch the parser, the semantic model or any integration.
 *
 * `FallbackRenderer` is how a caller keeps Mermaid out of this package's dependencies while still
 * having something to show for a diagram type it does not support. The caller owns that choice: a
 * documentation build might fall back to a code block, an app to client-side Mermaid.
 */

import type { AccessibilityOptions } from "../accessibility/describe.js";
import type { IconRegistry } from "../icons/registry.js";
import type { MeasureText } from "../layout/measure-text.js";
import type { LayoutResult } from "../model/layout.js";
import type { SemanticOptions } from "../model/semantic.js";
import type { DiagramThemeName } from "../themes/registry.js";
import type { DiagramTheme } from "../themes/theme.js";

export interface RenderResult {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
}

export interface FallbackRenderer {
  readonly render: (source: string) => RenderResult;
}

/**
 * Keyed on everything that changes the output, which is why the key is built by this package rather
 * than by the caller: the source alone is not enough — the same source under two themes is two
 * different SVGs.
 */
export interface DiagramCache {
  readonly get: (key: string) => RenderResult | undefined;
  readonly set: (key: string, result: RenderResult) => void;
}

export interface RenderOptions {
  readonly theme?: DiagramThemeName | DiagramTheme | undefined;
  readonly semantic?: SemanticOptions | undefined;
  readonly icons?: IconRegistry | undefined;
  readonly accessibility?: AccessibilityOptions | undefined;
  readonly measureText?: MeasureText | undefined;
  /** Parse as far as possible instead of throwing. See `ParseOptions.tolerant`. */
  readonly tolerant?: boolean | undefined;
  readonly fallback?: FallbackRenderer | undefined;
  readonly cache?: DiagramCache | undefined;
  /**
   * Where the theme's CSS goes. `"inline"`, the default, embeds it in every SVG — the only thing that
   * works for an SVG that will be opened on its own. `"external"` leaves it out, and the caller emits
   * `diagramStylesheet(theme)` once on the page; on a page with several diagrams that is most of the
   * bytes.
   */
  readonly stylesheet?: "inline" | "external" | undefined;
}

export interface DiagramRenderer {
  readonly render: (layout: LayoutResult, options: RenderOptions) => RenderResult;
}
