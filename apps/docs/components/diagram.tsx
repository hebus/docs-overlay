/**
 * Renders what `remarkDiagram` already produced. A server component with no `"use client"`, so the
 * diagram ships as markup and no renderer reaches the browser — the same rule the code blocks on this
 * site follow with Shiki.
 *
 * `dangerouslySetInnerHTML` is the only way to put an SVG string into the tree, and it is safe here
 * for a specific reason rather than by assumption: every label went through `escapeSvgText` when the
 * SVG was generated, and icon content is validated on registration.
 */
export function Diagram({ svg, source }: { readonly svg: string; readonly width?: string; readonly height?: string; readonly source?: string }) {
  return (
    <figure className="not-prose my-6">
      <div className="overflow-x-auto rounded-lg border border-fd-border bg-fd-card p-4" dangerouslySetInnerHTML={{ __html: svg }} />
      {source === undefined ? null : (
        // `<details>` works with no JavaScript, which is the point: the source is there to prove the
        // input is plain Mermaid, and proving it must not depend on a bundle.
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-fd-muted-foreground">Mermaid source</summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-fd-muted p-3 text-xs leading-relaxed">{source}</pre>
        </details>
      )}
    </figure>
  );
}
