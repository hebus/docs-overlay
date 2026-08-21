/**
 * One node. The outline comes from the Mermaid shape, the icon and the accent come from the semantic
 * type — that pairing is the whole product: an author writes `API["REST API"]` and gets a box that
 * says "api" without having said so.
 *
 * Colour is never written here. The shape carries classes and the stylesheet decides, which is what
 * lets a site restyle a diagram it did not generate.
 */

import { iconOf } from "../../layout/node-size.js";
import type { NodeShape } from "../../model/diagram.js";
import type { LayoutNode } from "../../model/layout.js";
import { ACCENT } from "./context.js";
import type { SvgContext } from "./context.js";
import { attributes, round, safeIdentifier } from "./escape.js";
import { renderIcon } from "./icon.js";
import { renderText } from "./text.js";

/** The shapes that can wear the accent stripe: the ones whose left edge is a straight vertical line. */
const STRIPED: readonly NodeShape[] = ["rectangle", "rounded", "subroutine"];

const STRIPE_WIDTH = 3;

/**
 * The node's silhouette, as a single element. Returned without a class so it can serve twice: once
 * painted, once inside a `<clipPath>` that keeps the accent stripe inside the outline.
 */
function silhouette(placed: LayoutNode, context: SvgContext, extra: Readonly<Record<string, string | number | undefined>> = {}): string {
  const { x, y, width: w, height: h, node } = placed;
  const radius = context.theme.node.cornerRadius;

  switch (node.shape) {
    case "rounded":
      return `<rect ${attributes({ ...extra, x, y, width: w, height: h, rx: radius })}/>`;
    case "stadium":
      return `<rect ${attributes({ ...extra, x, y, width: w, height: h, rx: h / 2 })}/>`;
    case "subroutine":
      return `<rect ${attributes({ ...extra, x, y, width: w, height: h, rx: 3 })}/>`;
    case "cylinder": {
      const ry = Math.min(9, h / 4);
      const d = [
        `M${round(x)} ${round(y + ry)}`,
        `a${round(w / 2)} ${round(ry)} 0 0 1 ${round(w)} 0`,
        `v${round(h - ry * 2)}`,
        `a${round(w / 2)} ${round(ry)} 0 0 1 ${round(-w)} 0`,
        "z"
      ].join(" ");
      return `<path ${attributes({ ...extra, d })}/>`;
    }
    case "circle":
      return `<circle ${attributes({ ...extra, cx: x + w / 2, cy: y + h / 2, r: Math.min(w, h) / 2 })}/>`;
    case "rhombus":
      return `<polygon ${attributes({
        ...extra,
        points: points([
          [x + w / 2, y],
          [x + w, y + h / 2],
          [x + w / 2, y + h],
          [x, y + h / 2]
        ])
      })}/>`;
    case "hexagon": {
      const inset = Math.min(w * 0.18, 22);
      return `<polygon ${attributes({
        ...extra,
        points: points([
          [x + inset, y],
          [x + w - inset, y],
          [x + w, y + h / 2],
          [x + w - inset, y + h],
          [x + inset, y + h],
          [x, y + h / 2]
        ])
      })}/>`;
    }
    case "junction":
      return `<circle ${attributes({ ...extra, cx: x + w / 2, cy: y + h / 2, r: context.theme.node.junctionRadius })}/>`;
    case "service":
      // Mermaid draws an architecture service as an icon with a caption and no box. Keeping that is
      // what makes an architecture diagram read differently from a flowchart at a glance.
      return "";
    default:
      return `<rect ${attributes({ ...extra, x, y, width: w, height: h, rx: 3 })}/>`;
  }
}

/** The lines drawn on top of a silhouette that a single element cannot express. */
function decorations(placed: LayoutNode): string {
  const { x, y, width: w, height: h, node } = placed;

  if (node.shape === "subroutine") {
    return `<path ${attributes({ class: "do-shape-line", d: `M${round(x + 7)} ${round(y)}V${round(y + h)}M${round(x + w - 7)} ${round(y)}V${round(y + h)}` })}/>`;
  }

  if (node.shape === "cylinder") {
    const ry = Math.min(9, h / 4);
    return `<path ${attributes({ class: "do-shape-line", d: `M${round(x)} ${round(y + ry)}a${round(w / 2)} ${round(ry)} 0 0 0 ${round(w)} 0` })}/>`;
  }

  return "";
}

function points(pairs: readonly (readonly [number, number])[]): string {
  return pairs.map(pair => `${round(pair[0])},${round(pair[1])}`).join(" ");
}

export function renderNode(placed: LayoutNode, context: SvgContext): string {
  const { theme } = context;
  const { node, label, x, y, width, height } = placed;
  const icon = iconOf(node, theme);
  const iconSize = theme.node.iconSize;

  if (node.shape === "junction") {
    return wrap(node, silhouette(placed, context, { class: "do-junction" }));
  }

  const parts: string[] = [silhouette(placed, context, { class: "do-shape" }), decorations(placed)];

  if (node.shape === "service") {
    if (icon !== undefined) {
      parts.push(renderIcon(icon, context.icons, { x: x + (width - iconSize) / 2, y: y + theme.node.paddingY, size: iconSize, stroke: ACCENT }));
    }
    parts.push(
      renderText(label, {
        x: x + width / 2,
        y: y + theme.node.paddingY + (icon === undefined ? 0 : iconSize + theme.node.iconGap),
        fontSize: theme.text.fontSize,
        lineHeight: theme.text.lineHeight,
        fill: context.color("fg"),
        fontWeight: theme.text.fontWeight,
        className: "do-label"
      })
    );
    return wrap(node, parts.join(""));
  }

  if (STRIPED.includes(node.shape) && node.type !== "unknown") {
    // A stripe on the leading edge, clipped by the node's own outline so it follows the corner radius
    // instead of approximating it — the approximation was wrong whenever the radius exceeded the
    // stripe width, which is every default theme. It repeats the icon's information on purpose: a
    // reader who cannot separate two accent hues still has the icon, and a skimming one has the stripe.
    const clipId = `do-clip-${safeIdentifier(node.id)}-${context.instance}`;
    parts.push(
      `<clipPath ${attributes({ id: clipId })}>${silhouette(placed, context)}</clipPath>`,
      `<rect ${attributes({ class: "do-accent", x, y, width: STRIPE_WIDTH, height, "clip-path": `url(#${clipId})` })}/>`
    );
  }

  const iconWidth = icon === undefined ? 0 : iconSize + theme.node.iconGap;
  const startX = x + (width - (iconWidth + label.width)) / 2;

  if (icon !== undefined) {
    parts.push(renderIcon(icon, context.icons, { x: startX, y: y + (height - iconSize) / 2, size: iconSize, stroke: ACCENT }));
  }

  parts.push(
    renderText(label, {
      x: startX + iconWidth + label.width / 2,
      y: y + (height - label.height) / 2,
      fontSize: theme.text.fontSize,
      lineHeight: theme.text.lineHeight,
      fill: context.color("fg"),
      fontWeight: theme.text.fontWeight,
      className: "do-label"
    })
  );

  return wrap(node, parts.join(""));
}

function wrap(node: LayoutNode["node"], body: string): string {
  const classes = ["do-node", `do-type-${node.type}`, ...node.classNames.map(name => `do-class-${safeIdentifier(name)}`)].join(" ");
  return `<g ${attributes({ class: classes, "data-id": node.id })}>${body}</g>`;
}
