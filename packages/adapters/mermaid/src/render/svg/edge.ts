/**
 * One edge: a rounded polyline plus its tips and label. The route was decided by the layout, so
 * nothing here is allowed to move a point — only to draw through them, which is what makes the same
 * layout reusable by a renderer that is not SVG at all.
 *
 * The label sits on an opaque plate rather than straight on the line. Without it, a label crossing
 * its own edge is unreadable, and that is the common case for a short label on a long link.
 */

import type { LayoutEdge } from "../../model/layout.js";
import type { Point } from "../../model/layout.js";
import type { EdgeArrow } from "../../model/diagram.js";
import { attributes, round } from "./escape.js";
import type { SvgContext } from "./context.js";
import { renderText } from "./text.js";

export function markerId(arrow: EdgeArrow, instance: string): string {
  return `do-${arrow}-${instance}`;
}

/**
 * A polyline with its corners rounded. Each bend is shortened by up to `radius` on both sides and
 * joined with a quadratic through the original corner, so the line still passes where the layout put
 * it — a circular arc would drift off it.
 */
export function roundedPath(points: readonly Point[], radius: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  if (first === undefined) return "";
  if (points.length < 3 || radius <= 0) {
    return (
      `M${round(first.x)} ${round(first.y)}` +
      points
        .slice(1)
        .map(point => `L${round(point.x)} ${round(point.y)}`)
        .join("")
    );
  }

  let path = `M${round(first.x)} ${round(first.y)}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    if (previous === undefined || corner === undefined || next === undefined) continue;

    const into = shorten(corner, previous, radius);
    const out = shorten(corner, next, radius);
    path += `L${round(into.x)} ${round(into.y)}Q${round(corner.x)} ${round(corner.y)} ${round(out.x)} ${round(out.y)}`;
  }

  const last = points[points.length - 1];
  if (last !== undefined) path += `L${round(last.x)} ${round(last.y)}`;
  return path;
}

/** Steps from `from` towards `to` by at most `distance`, and never past the halfway point. */
function shorten(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: from.x, y: from.y };
  const step = Math.min(distance, length / 2) / length;
  return { x: from.x + dx * step, y: from.y + dy * step };
}

export function renderEdge(placed: LayoutEdge, context: SvgContext): string {
  const { theme } = context;
  const { edge, points, label } = placed;
  if (points.length < 2) return "";

  const classes = ["do-edge", `do-edge-${edge.type}`].join(" ");
  const line = `<path ${attributes({
    class: classes,
    d: roundedPath(points, theme.edge.bendRadius),
    "marker-start": edge.sourceArrow === "none" ? undefined : `url(#${markerId(edge.sourceArrow, context.instance)})`,
    "marker-end": edge.targetArrow === "none" ? undefined : `url(#${markerId(edge.targetArrow, context.instance)})`
  })}/>`;

  if (label === undefined) return line;

  const plate = `<rect ${attributes({
    class: "do-edge-plate",
    x: label.x,
    y: label.y,
    width: label.width,
    height: label.height,
    rx: 3
  })}/>`;

  const text = renderText(
    { lines: [label.text], width: label.width, height: label.height },
    {
      x: label.x + label.width / 2,
      y: label.y + theme.edge.labelPaddingY,
      fontSize: theme.text.edgeFontSize,
      lineHeight: theme.text.lineHeight,
      fill: context.color("muted"),
      className: "do-edge-label"
    }
  );

  return `${line}${plate}${text}`;
}

/**
 * Arrow tips, one definition per shape, ids suffixed with the instance so two diagrams on one page do
 * not resolve each other's markers — a duplicated id in a document is won by the first one.
 */
export function renderMarkers(context: SvgContext): string {
  const size = context.theme.edge.arrowSize;
  const stroke = context.color("edge");

  const marker = (arrow: EdgeArrow, body: string, refX: number): string =>
    `<marker ${attributes({
      id: markerId(arrow, context.instance),
      viewBox: `0 0 ${size + 2} ${size + 2}`,
      refX,
      refY: (size + 2) / 2,
      markerWidth: size,
      markerHeight: size,
      orient: "auto-start-reverse",
      markerUnits: "userSpaceOnUse"
    })}>${body}</marker>`;

  const mid = (size + 2) / 2;

  return [
    marker("arrow", `<path ${attributes({ d: `M1 1L${round(size + 1)} ${round(mid)}L1 ${round(size + 1)}z`, fill: stroke })}/>`, size + 1),
    marker("circle", `<circle ${attributes({ cx: mid, cy: mid, r: mid - 1.2, fill: "none", stroke, "stroke-width": 1.4 })}/>`, size + 1),
    marker(
      "cross",
      `<path ${attributes({ d: `M1.5 1.5L${round(size + 0.5)} ${round(size + 0.5)}M${round(size + 0.5)} 1.5L1.5 ${round(size + 0.5)}`, stroke, "stroke-width": 1.4 })}/>`,
      size + 1
    )
  ].join("");
}
