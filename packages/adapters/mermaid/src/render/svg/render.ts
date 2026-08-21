/**
 * The SVG document. Paint order is groups, then edges, then nodes: a node must cover the line that
 * ends at it, and a group must sit behind both.
 *
 * Every selector is scoped to a class on the root element. An inline `<style>` in inline SVG is
 * document-global — unscoped rules named `.do-node` would style somebody else's markup — and the scope
 * is the theme name rather than a random id, so two diagrams sharing a theme emit byte-identical rules
 * and one copy of the stylesheet serves both.
 *
 * Which is the point of `stylesheet: "external"`. Inlined, these rules are the largest part of a small
 * diagram — around 4 kB against 2 kB of drawing — and a page with ten diagrams repeats them ten times.
 * A caller that can put CSS on the page once asks for `"external"` and emits `diagramStylesheet(theme)`
 * itself. `"inline"` stays the default: a lone SVG opened from disk has nowhere else to carry it.
 */

import { describe } from "../../accessibility/describe.js";
import { defaultIconRegistry } from "../../icons/registry.js";
import type { LayoutResult } from "../../model/layout.js";
import type { SemanticNodeType } from "../../model/semantic.js";
import type { DiagramThemeName } from "../../themes/registry.js";
import { resolveTheme } from "../../themes/registry.js";
import type { ColorToken, DiagramTheme, ThemeColors } from "../../themes/theme.js";
import { CSS_VARIABLES } from "../../themes/theme.js";
import type { RenderOptions, RenderResult } from "../renderer.js";
import type { SvgContext } from "./context.js";
import { shadowId } from "./context.js";
import { renderEdge, renderMarkers } from "./edge.js";
import { attributes, escapeSvgText, safeIdentifier } from "./escape.js";
import { renderGroup } from "./group.js";
import { renderNode } from "./node.js";

export function renderSvg(layout: LayoutResult, options: RenderOptions = {}): RenderResult {
  const theme = resolveTheme(options.theme);
  const scope = scopeOf(theme);
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
    options.stylesheet === "external" ? "" : `<style>${rulesFor(theme, scope)}</style>`,
    `<defs>${renderMarkers(context)}${shadowFilter(context)}</defs>`,
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

/**
 * The drop shadow, as a filter, once per document. `flood-opacity` carries the strength rather than a
 * colour, so the shadow stays a neutral darkening and does not fight the palette in dark mode.
 */
function shadowFilter(context: SvgContext): string {
  const shadow = context.theme.node.shadow;
  if (shadow === undefined) return "";

  return (
    `<filter ${attributes({ id: shadowId(context.instance), x: "-20%", y: "-20%", width: "140%", height: "140%" })}>` +
    `<feDropShadow ${attributes({ dx: 0, dy: shadow.dy, stdDeviation: shadow.blur, "flood-color": "#0f172a", "flood-opacity": shadow.opacity })}/>` +
    `</filter>`
  );
}

/** `var(--token, fallback)` against a specific palette, so the dark block can re-emit with dark fallbacks. */
function against(colors: ThemeColors): (name: ColorToken) => string {
  return name => `var(${CSS_VARIABLES[name]}, ${colors[name]})`;
}

function rules(theme: DiagramTheme, colors: ThemeColors, scope: string): string {
  const color = against(colors);
  const selector = (suffix: string): string => `.${scope} ${suffix}`;

  const base: string[] = [
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

  // Only when the theme draws one. A rule nobody references is dead weight in every SVG the theme
  // emits, and this stylesheet is already the largest part of a small diagram.
  if (theme.node.iconPlate !== undefined) base.push(`${selector(".do-icon-plate")}{fill:var(--do-accent,${color("accent")});stroke:none}`);

  // `--do-accent` is read by the stripe, the plate and an icon's stroke. A theme that draws none of the
  // three would ship fifteen declarations nothing consults — and this sheet is the largest part of a
  // small diagram, so a rule that does nothing is not free.
  const usesAccent =
    theme.node.accentStripe !== false ||
    theme.node.iconPlate !== undefined ||
    (theme.node.icons !== false && Object.values(theme.semanticTypes).some(entry => entry.icon !== undefined));

  const accents = usesAccent
    ? Object.entries(theme.semanticTypes).map(entry => {
        const [type, value] = entry as [SemanticNodeType, { readonly accent: string }];
        return `${selector(`.do-type-${type}`)}{--do-accent:${value.accent}}`;
      })
    : [];

  return [...base, ...accents].join("");
}

/**
 * The stylesheet for a theme, for a caller emitting it once on the page. Identical to what `"inline"`
 * would have embedded, so the two modes cannot drift: there is one implementation.
 */
export function diagramStylesheet(theme: DiagramThemeName | DiagramTheme | undefined): string {
  const resolved = resolveTheme(theme);
  return rulesFor(resolved, scopeOf(resolved));
}

/** The class that scopes every rule, and that `renderSvg` puts on the root element. */
export function scopeOf(theme: DiagramTheme): string {
  return `do-diagram-${safeIdentifier(theme.name)}`;
}

function rulesFor(theme: DiagramTheme, scope: string): string {
  const root = `.${scope}{font-family:${theme.text.fontFamily};background:${against(theme.colors)("bg")}}`;
  const dark = `@media (prefers-color-scheme:dark){${rules(theme, theme.darkColors, scope)}}`;
  // Light is the base declaration and dark overrides it, so a viewer with no preference gets light and
  // the custom properties still win in either — which is what lets a site with its own dark toggle
  // set them and not fight the media query.
  return `${root}${rules(theme, theme.colors, scope)}${dark}`;
}
