/**
 * What every renderer function needs and none of them should look up for itself: the theme, the icon
 * registry, a colour resolver, and the per-SVG suffix that keeps ids and marker references from
 * colliding when a page holds more than one diagram.
 */

import type { IconRegistry } from "../../icons/registry.js";
import type { ColorToken, DiagramTheme } from "../../themes/theme.js";

export interface SvgContext {
  readonly theme: DiagramTheme;
  readonly icons: IconRegistry;
  /** `var(--docs-overlay-diagram-…, fallback)` for a token. */
  readonly color: (name: ColorToken) => string;
  /** Appended to every id this SVG defines. Derived from the content, so it stays deterministic. */
  readonly instance: string;
}

/** The accent of the node's semantic type, set per node by a class in the stylesheet. */
export const ACCENT = "var(--do-accent)";

/** Suffixed with the instance, like every other id, so two diagrams on a page keep their own filter. */
export function shadowId(instance: string): string {
  return `do-shadow-${instance}`;
}
