/**
 * Text, as `<text>` and `<tspan>` rather than a `<foreignObject>` holding HTML. `<foreignObject>` is
 * how Mermaid wraps labels and it is why a Mermaid SVG cannot be pasted into a static site and
 * trusted: it renders in a browser, and nowhere else — not in an `<img>`, not in a PDF, not in a
 * thumbnail. Wrapping is done by the layout instead, which is why it needed font metrics.
 */

import type { MeasuredLabel } from "../../model/layout.js";
import { attributes, escapeSvgText } from "./escape.js";

export interface TextOptions {
  /** Centre of the text block on the x axis. */
  readonly x: number;
  /** Top of the text block. */
  readonly y: number;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fill: string;
  readonly fontWeight?: number | undefined;
  readonly className?: string | undefined;
}

export function renderText(label: MeasuredLabel, options: TextOptions): string {
  if (label.lines.length === 0) return "";

  const step = options.fontSize * options.lineHeight;
  // `dominant-baseline` is unevenly supported once an SVG leaves the browser, so the first baseline is
  // computed instead: the cap of the line plus roughly the ascent.
  const firstBaseline = options.y + options.fontSize * 0.82 + (step - options.fontSize) / 2;

  const spans = label.lines
    .map((line, index) => `<tspan ${attributes({ x: options.x, y: firstBaseline + index * step })}>${escapeSvgText(line)}</tspan>`)
    .join("");

  return `<text ${attributes({
    class: options.className,
    "text-anchor": "middle",
    "font-size": options.fontSize,
    "font-weight": options.fontWeight,
    fill: options.fill
  })}>${spans}</text>`;
}
