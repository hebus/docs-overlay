/**
 * `minimal`: the diagram and nothing else.
 *
 * Very little decoration was the whole brief, and the honest reading of it is subtractive — no icon, no
 * accent bar, no shadow, no plate, a small radius, a hairline border, one ink colour. What is left is
 * the shape, the label and the line, which is what a wireframe or a printed page wants.
 *
 * That has a side effect worth naming: with no stripe, no plate and no icons, nothing reads
 * `--do-accent`, so the renderer omits the fifteen per-type declarations as well. This theme is the
 * smallest of the three in bytes, not only in ink — its stylesheet is roughly half the size.
 *
 * The semantic types are still resolved, and still land on the `do-type-*` classes: a site that wants
 * one back can restyle it from its own stylesheet without regenerating anything.
 */

import type { DiagramTheme, ThemeColors } from "./theme.js";
import { technicalTheme } from "./technical.js";

const LIGHT: ThemeColors = {
  bg: "transparent",
  fg: "#1a1a1a",
  muted: "#6b7280",
  accent: "#1a1a1a",
  nodeBg: "#ffffff",
  nodeBorder: "#c9ced6",
  groupBg: "transparent",
  groupBorder: "#d7dbe1",
  edge: "#8b929c"
};

const DARK: ThemeColors = {
  bg: "transparent",
  fg: "#e8eaed",
  muted: "#9ba1aa",
  accent: "#e8eaed",
  nodeBg: "transparent",
  nodeBorder: "#3a4048",
  groupBg: "transparent",
  groupBorder: "#32383f",
  edge: "#727a85"
};

/** Every type unstyled and iconless: the accent exists for a consumer who restyles, not for the theme. */
const PLAIN = { accent: "#6b7280", icon: undefined } as const;

export const minimalTheme: DiagramTheme = {
  name: "minimal",
  colors: LIGHT,
  darkColors: DARK,
  node: {
    paddingX: 12,
    paddingY: 8,
    minWidth: 78,
    minHeight: 36,
    maxLabelWidth: 160,
    cornerRadius: 3,
    borderWidth: 1,
    // Sensible values a consumer gets if they copy this theme and flip `icons` back on.
    iconSize: 16,
    iconGap: 8,
    junctionRadius: 3,
    accentStripe: false,
    icons: false
  },
  edge: {
    width: 1,
    dashArray: "3 3",
    thickWidth: 2,
    arrowSize: 6,
    labelPaddingX: 4,
    labelPaddingY: 1,
    bendRadius: 0
  },
  group: {
    padding: 14,
    headerHeight: 22,
    cornerRadius: 4,
    borderWidth: 1,
    dashArray: "none"
  },
  text: {
    fontFamily: technicalTheme.text.fontFamily,
    fontSize: 12.5,
    lineHeight: 1.3,
    edgeFontSize: 10.5,
    groupFontSize: 11.5,
    fontWeight: 450
  },
  spacing: {
    nodeGap: 22,
    rankGap: 46,
    margin: 10
  },
  semanticTypes: {
    person: PLAIN,
    application: PLAIN,
    frontend: PLAIN,
    backend: PLAIN,
    api: PLAIN,
    server: PLAIN,
    database: PLAIN,
    cache: PLAIN,
    queue: PLAIN,
    cloud: PLAIN,
    storage: PLAIN,
    service: PLAIN,
    component: PLAIN,
    file: PLAIN,
    unknown: PLAIN
  }
};
