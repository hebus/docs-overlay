/**
 * `technical`: the one theme in this first cut. A professional architecture drawing — flat fills, a
 * one-pixel border, an accent that carries the semantic type, and no decoration that does not say
 * something. `illustrated` comes next and will be a different file, not a flag in this one.
 *
 * The accent hues are chosen to stay distinguishable in both schemes and to survive the common forms
 * of colour blindness by pairing hue with position: the bar is always on the same edge, so a reader
 * who cannot separate the teal from the green still sees two different icons.
 */

import type { DiagramTheme, ThemeColors } from "./theme.js";

const LIGHT: ThemeColors = {
  bg: "transparent",
  fg: "#1f2933",
  muted: "#5c6b7a",
  accent: "#2f6feb",
  nodeBg: "#ffffff",
  nodeBorder: "#cbd4de",
  groupBg: "#f6f8fa",
  groupBorder: "#d3dae2",
  edge: "#8a97a6"
};

const DARK: ThemeColors = {
  bg: "transparent",
  fg: "#e6edf3",
  muted: "#9aa7b4",
  accent: "#589bff",
  nodeBg: "#161b22",
  nodeBorder: "#30363d",
  groupBg: "#0f141a",
  groupBorder: "#2a3138",
  edge: "#6e7b8a"
};

export const technicalTheme: DiagramTheme = {
  name: "technical",
  colors: LIGHT,
  darkColors: DARK,
  node: {
    paddingX: 14,
    paddingY: 10,
    minWidth: 92,
    minHeight: 44,
    maxLabelWidth: 168,
    cornerRadius: 6,
    borderWidth: 1,
    iconSize: 20,
    iconGap: 8,
    junctionRadius: 4
  },
  edge: {
    width: 1.25,
    dashArray: "4 3",
    thickWidth: 2.5,
    arrowSize: 7,
    labelPaddingX: 5,
    labelPaddingY: 2,
    bendRadius: 6
  },
  group: {
    padding: 18,
    headerHeight: 26,
    cornerRadius: 8,
    borderWidth: 1,
    dashArray: "none"
  },
  text: {
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    fontSize: 13,
    lineHeight: 1.35,
    edgeFontSize: 11,
    groupFontSize: 12,
    fontWeight: 500
  },
  spacing: {
    nodeGap: 26,
    rankGap: 56,
    margin: 12
  },
  semanticTypes: {
    person: { accent: "#8957e5", icon: "user" },
    application: { accent: "#2f6feb", icon: "application" },
    frontend: { accent: "#2f6feb", icon: "frontend" },
    backend: { accent: "#1a7f64", icon: "backend" },
    api: { accent: "#0969da", icon: "api" },
    server: { accent: "#1a7f64", icon: "server" },
    database: { accent: "#bf5b04", icon: "database" },
    cache: { accent: "#c9401f", icon: "cache" },
    queue: { accent: "#9a6700", icon: "queue" },
    cloud: { accent: "#0f7f8c", icon: "cloud" },
    storage: { accent: "#6e5494", icon: "storage" },
    service: { accent: "#1f6feb", icon: "service" },
    component: { accent: "#57606a", icon: "component" },
    file: { accent: "#57606a", icon: "file" },
    unknown: { accent: "#8a97a6", icon: undefined }
  }
};
