/**
 * The icon set, inline and complete. Nothing is fetched at render time — not from a CDN, not from an
 * Iconify API — because a build that reaches the network is a build that fails on someone else's
 * machine, and because an icon arriving late is an icon that changes the layout after it was
 * measured.
 *
 * All geometry, no colour: the renderer sets `stroke` from the semantic accent, so one icon works in
 * light and dark and in a theme that has not been written yet. Stroke-only also keeps them legible at
 * 20px, which is the size they are actually drawn at.
 *
 * `database`, `server`, `disk`, `internet`, `cloud`, `unknown` and `blank` carry the names Mermaid's
 * own `architecture-beta` ships, so a diagram written against Mermaid renders here unchanged.
 */

export interface IconDefinition {
  readonly id: string;
  readonly viewBox: string;
  /** SVG geometry only. Validated on registration — see `icons/registry.ts`. */
  readonly content: string;
}

const BOX = "0 0 24 24";

function icon(id: string, content: string): IconDefinition {
  return { id, viewBox: BOX, content };
}

export const defaultIcons: readonly IconDefinition[] = [
  icon(
    "database",
    '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6"/><path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3"/>'
  ),
  icon(
    "server",
    '<rect x="3" y="4" width="18" height="6.5" rx="1.5"/><rect x="3" y="13.5" width="18" height="6.5" rx="1.5"/><path d="M6.5 7.25h.01M6.5 16.75h.01"/>'
  ),
  icon("cloud", '<path d="M7 18.5h10.2a3.8 3.8 0 0 0 .4-7.58 5.9 5.9 0 0 0-11.3-1.2A4.2 4.2 0 0 0 7 18.5z"/>'),
  icon("internet", '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9z"/>'),
  icon("disk", '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/><path d="M12 3v6.4"/>'),
  icon("storage", '<path d="M3.5 6h17l-1.7 13.3a1 1 0 0 1-1 .7H6.2a1 1 0 0 1-1-.7L3.5 6z"/><path d="M2.5 6h19"/>'),
  icon("user", '<circle cx="12" cy="8" r="3.6"/><path d="M5 20.5a7 7 0 0 1 14 0"/>'),
  icon("api", '<path d="M9.2 4C6.7 4 7.7 11 4.7 11c3 0 2 7 4.5 7"/><path d="M14.8 4c2.5 0 1.5 7 4.5 7-3 0-2 7-4.5 7"/>'),
  icon(
    "queue",
    '<path d="M2.5 20h19"/><rect x="3" y="4.5" width="5" height="10" rx="1"/><rect x="9.5" y="4.5" width="5" height="10" rx="1"/><rect x="16" y="4.5" width="5" height="10" rx="1"/>'
  ),
  icon("cache", '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M13.4 7.5 9 13.2h3.1L11.2 17l4.4-5.7h-3.1z"/>'),
  icon("frontend", '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.2h18"/><path d="M6.2 6.6h.01M8.8 6.6h.01"/>'),
  icon("backend", '<path d="M12 3 20 7.2 12 11.4 4 7.2 12 3z"/><path d="M4 12l8 4.2 8-4.2"/><path d="M4 16.8 12 21l8-4.2"/>'),
  icon("application", '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M10 18h4"/>'),
  icon("service", '<path d="M12 3.2 19.6 7.6v8.8L12 20.8 4.4 16.4V7.6L12 3.2z"/><circle cx="12" cy="12" r="2.6"/>'),
  icon(
    "component",
    '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.2"/>'
  ),
  icon("file", '<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8l-5-5z"/><path d="M14 3v5h5"/>'),
  icon("unknown", '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.5a2.6 2.6 0 1 1 3.7 2.4c-.7.3-1.1 1-1.1 1.8"/><path d="M12 17.2h.01"/>'),
  icon("blank", "")
];
