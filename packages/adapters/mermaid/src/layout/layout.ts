/**
 * Which engine lays out which diagram. The two are genuinely different algorithms — a layered graph
 * for flowcharts, a constraint grid for architecture — and that is the point of the split: neither
 * has to compromise for the other, and a third can arrive without either changing.
 */

import { MermaidError } from "../errors.js";
import type { LayoutResult } from "../model/layout.js";
import type { SemanticDiagram } from "../model/semantic.js";
import type { DiagramThemeName } from "../themes/registry.js";
import { resolveTheme } from "../themes/registry.js";
import type { DiagramTheme } from "../themes/theme.js";
import { layoutArchitecture } from "./architecture.js";
import { layoutFlowchart } from "./flowchart.js";
import type { MeasureText } from "./measure-text.js";

export interface LayoutOptions {
  readonly theme?: DiagramThemeName | DiagramTheme | undefined;
  /**
   * Real font metrics, when the caller has them. The built-in estimate is deliberately a few percent
   * generous; a browser consumer can pass a canvas measurer and get boxes that fit exactly.
   */
  readonly measureText?: MeasureText | undefined;
}

export function layoutDiagram(diagram: SemanticDiagram, options: LayoutOptions = {}): LayoutResult {
  const theme = resolveTheme(options.theme);

  if (diagram.type === "flowchart") return layoutFlowchart(diagram, { theme, measure: options.measureText });
  if (diagram.type === "architecture") return layoutArchitecture(diagram, { theme, measure: options.measureText });

  throw new MermaidError("layout-unavailable", `No layout engine handles \`${diagram.type}\` diagrams.`, { diagramType: diagram.type });
}
