/**
 * Draws a registry icon at a given box. The icon's own coordinates are its `viewBox`, so it is placed
 * with a `translate` plus a `scale` rather than by rewriting its geometry — that keeps an icon
 * definition a plain string somebody can read, and keeps this file from needing a path parser.
 */

import type { IconRegistry } from "../../icons/registry.js";
import { attributes, round } from "./escape.js";

export interface IconOptions {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly stroke: string;
}

/** `0 0 24 24` → the scale that fits it into `size`. Falls back to 24 for a malformed viewBox. */
function scaleOf(viewBox: string, size: number): number {
  const parts = viewBox.split(/\s+/).map(Number);
  const width = parts[2];
  const height = parts[3];
  const extent = Math.max(width ?? 24, height ?? 24);
  return size / (Number.isFinite(extent) && extent > 0 ? extent : 24);
}

export function renderIcon(name: string, registry: IconRegistry, options: IconOptions): string {
  const icon = registry.get(name);
  if (icon === undefined || icon.content === "") return "";

  const scale = scaleOf(icon.viewBox, options.size);
  const transform = `translate(${round(options.x)} ${round(options.y)}) scale(${round(scale)})`;

  // Geometry only, so stroke and the joins live here rather than in every icon definition.
  return `<g ${attributes({
    class: "do-icon",
    transform,
    fill: "none",
    stroke: options.stroke,
    "stroke-width": round(1.7 / scale),
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  })}>${icon.content}</g>`;
}
