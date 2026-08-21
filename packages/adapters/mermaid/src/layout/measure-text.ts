/**
 * How wide is "PostgreSQL" at 13px? Without a DOM there is nobody to ask, and every box size in
 * every diagram depends on the answer. The plan for this package said "no `window`, no `document`";
 * this module is what that costs.
 *
 * So: per-character advance widths as a fraction of the font size, bucketed by glyph class. It is an
 * approximation and it is meant to be — a few percent wide is invisible, and being wide rather than
 * narrow is the safe direction, because a box slightly too big looks deliberate and a box slightly
 * too small clips the label. A consumer running in a browser can hand over a real measurer through
 * `RenderOptions.measureText` and get exact boxes.
 *
 * Calibrated against Inter / system-ui, which is what the themes ask for.
 */

import type { MeasuredLabel } from "../model/layout.js";

/** Width of one line of text, in pixels, at `fontSize`. */
export type MeasureText = (text: string, fontSize: number) => number;

const NARROW = new Set("ijltfIJ.,:;!|'\"`()[]{}·-");
const WIDE = new Set("mwMWQ@%&");
const UPPER = /[A-ZÀ-ÞĀ-Ž]/;
const DIGIT = /[0-9]/;

/** Fractions of the font size. Sans-serif lowercase sits near 0.5em; the rest is measured off that. */
const ADVANCE = { narrow: 0.31, wide: 0.86, upper: 0.66, digit: 0.55, space: 0.28, other: 0.52 } as const;

export const estimateTextWidth: MeasureText = (text, fontSize) => {
  let advance = 0;
  for (const char of text) {
    if (char === " ") advance += ADVANCE.space;
    else if (NARROW.has(char)) advance += ADVANCE.narrow;
    else if (WIDE.has(char)) advance += ADVANCE.wide;
    else if (DIGIT.test(char)) advance += ADVANCE.digit;
    else if (UPPER.test(char)) advance += ADVANCE.upper;
    else advance += ADVANCE.other;
  }
  return advance * fontSize;
};

/**
 * Greedy word wrap. A word longer than `maxWidth` is left alone rather than broken: hyphenating
 * `PostgreSQL` into `Postgre-SQL` is worse than a box that sticks out.
 */
export function wrapText(text: string, fontSize: number, maxWidth: number, measure: MeasureText = estimateTextWidth): readonly string[] {
  const words = text.split(/\s+/).filter(word => word !== "");
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0] ?? "";

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (measure(candidate, fontSize) <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }

  lines.push(current);
  return lines;
}

export interface MeasureLabelOptions {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly maxWidth: number;
  readonly measure?: MeasureText | undefined;
}

export function measureLabel(text: string, options: MeasureLabelOptions): MeasuredLabel {
  const measure = options.measure ?? estimateTextWidth;
  const lines = wrapText(text, options.fontSize, options.maxWidth, measure);
  const width = lines.reduce((widest, line) => Math.max(widest, measure(line, options.fontSize)), 0);
  return { lines, width, height: lines.length * options.fontSize * options.lineHeight };
}
