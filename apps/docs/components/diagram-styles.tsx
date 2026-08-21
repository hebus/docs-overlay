import { diagramStylesheet } from "docs-overlay-mermaid";

/**
 * The theme's CSS, once per page.
 *
 * Every diagram would otherwise carry its own copy — 4.3 kB against about 2 kB of actual drawing — and
 * the page that documents this renders four of them. `remarkDiagram` emits this element only on a page
 * that has at least one diagram, so a page without one carries nothing.
 *
 * Scoped by a class the renderer puts on each `<svg>`, so this cannot leak into the rest of the page.
 */
export function DiagramStyles({ theme }: { readonly theme?: "technical" | "illustrated" }) {
  return <style dangerouslySetInnerHTML={{ __html: diagramStylesheet(theme ?? "technical") }} />;
}
