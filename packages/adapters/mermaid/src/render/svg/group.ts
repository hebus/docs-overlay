/**
 * A group box with its title bar. Drawn before the nodes so it sits behind them, and outermost first
 * so a nested group paints on top of its parent — that ordering is the only thing making nesting
 * legible without transparency tricks.
 */

import type { LayoutGroup } from "../../model/layout.js";
import { attributes, safeIdentifier } from "./escape.js";
import type { SvgContext } from "./context.js";
import { renderIcon } from "./icon.js";
import { renderText } from "./text.js";

export function renderGroup(placed: LayoutGroup, context: SvgContext): string {
  const { theme } = context;
  const { group, label, x, y, width, height, depth } = placed;
  const radius = theme.group.cornerRadius;

  const box = `<rect ${attributes({ class: "do-group-box", x, y, width, height, rx: radius })}/>`;

  const parts = [box];
  const header = theme.group.headerHeight;
  const iconSize = Math.round(theme.text.groupFontSize * 1.25);
  const padding = theme.group.padding / 2;

  const hasIcon = group.icon !== undefined && context.icons.get(group.icon) !== undefined;
  if (hasIcon && group.icon !== undefined) {
    parts.push(renderIcon(group.icon, context.icons, { x: x + padding, y: y + (header - iconSize) / 2, size: iconSize, stroke: context.color("muted") }));
  }

  if (label.lines.length > 0) {
    const textLeft = x + padding + (hasIcon ? iconSize + 5 : 0);
    parts.push(
      // Left-aligned, unlike a node label: a title bar reads as a heading, and centring it would make
      // a wide group's title float in the middle of nothing. `renderText` anchors on the middle, so
      // the left edge plus half the measured width is where that middle lands.
      renderText(label, {
        x: textLeft + label.width / 2,
        y: y + (header - label.height) / 2,
        fontSize: theme.text.groupFontSize,
        lineHeight: theme.text.lineHeight,
        fill: context.color("muted"),
        fontWeight: theme.text.fontWeight,
        className: "do-group-label"
      })
    );
  }

  const classes = ["do-group", `do-group-depth-${depth}`, `do-group-${safeIdentifier(group.id)}`].join(" ");
  return `<g ${attributes({ class: classes, "data-id": group.id })}>${parts.join("")}</g>`;
}
