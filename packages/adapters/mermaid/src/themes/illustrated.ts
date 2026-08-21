/**
 * `illustrated`: the same information as `technical`, drawn as cards.
 *
 * The brief was "modern, professional, lightly illustrated, suitable for developer documentation — not
 * childish, not cartoon, not photoreal". Three things carry that, and none of them is a picture:
 *
 * - **an icon on a tinted plate**, so a node reads as a labelled object rather than text in a box;
 * - **a soft shadow and a generous radius**, which is what makes a rectangle read as a card;
 * - **more air** — bigger type, wider gaps — because the density that suits a dense flowchart is what
 *   makes an illustration look cramped.
 *
 * What it deliberately does not do: gradients, outlines that imitate hand-drawing, or a second colour
 * per node. Each would date the output, and a diagram in documentation outlives the styling fashion it
 * was drawn in.
 */

import type { DiagramTheme, ThemeColors } from "./theme.js";
import { technicalTheme } from "./technical.js";

const LIGHT: ThemeColors = {
  bg: "transparent",
  fg: "#111827",
  muted: "#5b6673",
  accent: "#3b6ef6",
  nodeBg: "#ffffff",
  nodeBorder: "#e6eaf0",
  groupBg: "#f4f7fb",
  groupBorder: "#dfe6ef",
  edge: "#9aa6b6"
};

const DARK: ThemeColors = {
  bg: "transparent",
  fg: "#f0f4f9",
  muted: "#9fb0c2",
  accent: "#7aa7ff",
  nodeBg: "#1a2130",
  nodeBorder: "#2b3547",
  groupBg: "#131924",
  groupBorder: "#25303f",
  edge: "#71829a"
};

export const illustratedTheme: DiagramTheme = {
  name: "illustrated",
  colors: LIGHT,
  darkColors: DARK,
  node: {
    paddingX: 16,
    paddingY: 14,
    minWidth: 116,
    minHeight: 60,
    maxLabelWidth: 176,
    cornerRadius: 14,
    borderWidth: 1,
    iconSize: 22,
    iconGap: 12,
    junctionRadius: 5,
    // Small and low: a shadow you can name is a shadow that has become the subject.
    shadow: { dy: 1.5, blur: 3, opacity: 0.1 },
    iconPlate: { radius: 9, opacity: 0.12, padding: 8 }
  },
  edge: {
    width: 1.5,
    dashArray: "5 4",
    thickWidth: 3,
    arrowSize: 8,
    labelPaddingX: 7,
    labelPaddingY: 3,
    // Wide enough that a right angle reads as a turn rather than a corner.
    bendRadius: 12
  },
  group: {
    padding: 22,
    headerHeight: 32,
    cornerRadius: 18,
    borderWidth: 1,
    dashArray: "none"
  },
  text: {
    fontFamily: technicalTheme.text.fontFamily,
    fontSize: 14,
    lineHeight: 1.4,
    edgeFontSize: 12,
    groupFontSize: 13,
    fontWeight: 550
  },
  spacing: {
    nodeGap: 34,
    rankGap: 68,
    margin: 16
  },
  // Same mapping as `technical`, one notch brighter: the accent now tints a plate as well as a stripe,
  // and a colour that reads well as a 3px bar is too dark behind an icon.
  semanticTypes: {
    person: { accent: "#9a5ff0", icon: "user" },
    application: { accent: "#3b6ef6", icon: "application" },
    frontend: { accent: "#3b6ef6", icon: "frontend" },
    backend: { accent: "#12876a", icon: "backend" },
    api: { accent: "#0b74e8", icon: "api" },
    server: { accent: "#12876a", icon: "server" },
    database: { accent: "#d0690a", icon: "database" },
    cache: { accent: "#dd4b26", icon: "cache" },
    queue: { accent: "#ad7500", icon: "queue" },
    cloud: { accent: "#0d8fa0", icon: "cloud" },
    storage: { accent: "#7a5fbe", icon: "storage" },
    service: { accent: "#2b7bf5", icon: "service" },
    component: { accent: "#5f6b7a", icon: "component" },
    file: { accent: "#5f6b7a", icon: "file" },
    unknown: { accent: "#9aa6b6", icon: undefined }
  }
};
