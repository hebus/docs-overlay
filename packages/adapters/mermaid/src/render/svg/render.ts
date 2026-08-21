/**
 * The SVG document. Paint order is groups, then edges, then nodes: a node must cover the line that
 * ends at it, and a group must sit behind both.
 *
 * The stylesheet is emitted inside the SVG and every selector is scoped to a class on the root
 * element. An inline `<style>` in inline SVG is document-global — unscoped rules named `.do-node`
 * would style somebody else's markup — and the scope is the theme name rather than a random id so
 * two diagrams sharing a theme emit byte-identical rules.
 */

import { describe } from "../../accessibility/describe.js";
import { defaultIconRegistry } from "../../icons/registry.js";
import type { LayoutResult } from "../../model/layout.js";
import type { SemanticNodeType } from "../../model/semantic.js";
import { resolveTheme } from "../../themes/registry.js";
import type { ColorToken, DiagramTheme, ThemeColors } from "../../themes/theme.js";
import { CSS_VARIABLES } from "../../themes/theme.js";
import type { RenderOptions, RenderResult } from "../renderer.js";
import type { SvgContext } from "./context.js";
import { renderEdge, renderMarkers } from "./edge.js";
import { attributes, escapeSvgText, safeIdentifier } from "./escape.js";
import { renderGroup } from "./group.js";
import { renderNode } from "./node.js";

export function renderSvg(layout: LayoutResult, options: RenderOptions = {}): RenderResult {
  const theme = resolveTheme(options.theme);
  const scope = `do-diagram-${safeIdentifier(theme.name)}`;
  const described = describe(layout, options.accessibility);

  const context: SvgContext = {
    theme,
    icons: options.icons ?? defaultIconRegistry,
    color: name => `var(${CSS_VARIABLES[name]}, ${theme.colors[name]})`,
    instance: described.instance
  };

  const titleId = `do-t-${described.instance}`;
  const descId = `do-d-${described.instance}`;

  const body = [
    `<title ${attributes({ id: titleId })}>${escapeSvgText(described.title)}</title>`,
    `<desc ${attributes({ id: descId })}>${escapeSvgText(described.description)}</desc>`,
    `<style>${stylesheet(theme, scope)}</style>`,
    `<defs>${renderMarkers(context)}</defs>`,
    `<g ${attributes({ class: "do-groups" })}>${layout.groups.map(group => renderGroup(group, context)).join("")}</g>`,
    `<g ${attributes({ class: "do-edges" })}>${layout.edges.map(edge => renderEdge(edge, context)).join("")}</g>`,
    `<g ${attributes({ class: "do-nodes" })}>${layout.nodes.map(node => renderNode(node, context)).join("")}</g>`
  ].join("");

  const svg = `<svg ${attributes({
    xmlns: "http://www.w3.org/2000/svg",
    class: `do-diagram ${scope}`,
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    width: layout.width,
    height: layout.height,
    // Responsive without a media query: the box shrinks with its container and the aspect ratio holds.
    style: "max-width:100%;height:auto",
    role: "img",
    "aria-labelledby": `${titleId} ${descId}`
  })}>${body}</svg>`;

  return { svg, width: layout.width, height: layout.height };
}

/** `var(--token, fallback)` against a specific palette, so the dark block can re-emit with dark fallbacks. */
function against(colors: ThemeColors): (name: ColorToken) => string {
  return name => `var(${CSS_VARIABLES[name]}, ${colors[name]})`;
}

function rules(theme: DiagramTheme, colors: ThemeColors, scope: string): string {
  const color = against(colors);
  const selector = (suffix: string): string => `.${scope} ${suffix}`;

  const base = [
    `${selector(".do-shape")}{fill:${color("nodeBg")};stroke:${color("nodeBorder")};stroke-width:${theme.node.borderWidth}}`,
    `${selector(".do-shape-line")}{fill:none;stroke:${color("nodeBorder")};stroke-width:${theme.node.borderWidth}}`,
    `${selector(".do-junction")}{fill:${color("edge")};stroke:none}`,
    `${selector(".do-accent")}{fill:var(--do-accent,${color("accent")});stroke:none}`,
    `${selector(".do-edge")}{fill:none;stroke:${color("edge")};stroke-width:${theme.edge.width};stroke-linecap:round}`,
    `${selector(".do-edge-dotted")}{stroke-dasharray:${theme.edge.dashArray}}`,
    `${selector(".do-edge-thick")}{stroke-width:${theme.edge.thickWidth}}`,
    `${selector(".do-edge-plate")}{fill:${color("nodeBg")};stroke:none}`,
    `${selector(".do-group-box")}{fill:${color("groupBg")};stroke:${color("groupBorder")};stroke-width:${theme.group.borderWidth}}`,
    `${selector(".do-label")}{fill:${color("fg")}}`,
    `${selector(".do-group-label")},${selector(".do-edge-label")}{fill:${color("muted")}}`
  ];

  const accents = Object.entries(theme.semanticTypes).map(entry => {
    const [type, value] = entry as [SemanticNodeType, { readonly accent: string }];
    return `${selector(`.do-type-${type}`)}{--do-accent:${value.accent}}`;
  });

  return [...base, ...accents].join("");
}

function stylesheet(theme: DiagramTheme, scope: string): string {
  const root = `.${scope}{font-family:${theme.text.fontFamily};background:${against(theme.colors)("bg")}}`;
  const dark = `@media (prefers-color-scheme:dark){${rules(theme, theme.darkColors, scope)}}`;
  // Light is the base declaration and dark overrides it, so a viewer with no preference gets light and
  // the custom properties still win in either — which is what lets a site with its own dark toggle
  // set them and not fight the media query.
  return `${root}${rules(theme, theme.colors, scope)}${dark}`;
}
