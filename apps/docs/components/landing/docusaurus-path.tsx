import { ArrowRight } from "lucide-react";

import { Reveal } from "./reveal";

/**
 * The Docusaurus half, which the landing page used to leave out entirely.
 *
 * It is a genuinely different shape from the Fumadocs one and saying so is the point: Docusaurus reads
 * its versions from fixed paths on disk, before any plugin hook could intervene, so the only window is
 * before the build and the only thing that fits through it is a real tree.
 */
export function DocusaurusPath() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Reveal>
        <article className="h-full rounded-xl border border-fd-border bg-fd-card/50 p-6">
          <p className="text-sm font-medium text-fd-muted-foreground">Source — committed, diffs only</p>

          <pre className="mt-4 overflow-x-auto rounded-lg bg-fd-secondary/60 p-3 font-mono text-xs leading-5 text-fd-foreground">
            content/docs/{"\n"} 1.0.0/ the complete tree{"\n"} 2.0.0/ only what changed{"\n"} next/ work in progress
          </pre>

          <ul className="mt-5 space-y-2 text-sm text-fd-muted-foreground">
            <li>The only tree anybody edits</li>
            <li>One file per page, whatever the version count</li>
            <li>Renames and removals are frontmatter</li>
          </ul>
        </article>
      </Reveal>

      <Reveal delay={0.08}>
        <article className="relative h-full overflow-hidden rounded-xl border border-do-accent/35 bg-fd-card p-6">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-do-accent to-do-accent-2" />

          <p className="text-sm font-medium text-do-accent">Generated — gitignored, rewritten each build</p>

          <pre className="mt-4 overflow-x-auto rounded-lg bg-fd-secondary/60 p-3 font-mono text-xs leading-5 text-fd-muted-foreground">
            versions.json{"\n"}versioned_docs/version-*/{"\n"}versioned_sidebars/*.json{"\n"}.docs-overlay/current/
          </pre>

          <ul className="mt-5 space-y-2 text-sm text-fd-muted-foreground">
            <li>Exactly what Docusaurus expects, at the paths it hardcodes</li>
            <li>The same URLs as before, so no external link moves</li>
            <li>Pages copied byte for byte, never re-emitted</li>
          </ul>
        </article>
      </Reveal>

      <Reveal delay={0.14} className="lg:col-span-2">
        <div className="rounded-xl border border-fd-border bg-fd-card/50 px-6 py-6">
          <p className="flex flex-wrap items-center justify-center gap-3 text-center text-sm text-fd-muted-foreground">
            <code className="font-mono text-fd-foreground">content/docs/</code>
            <ArrowRight aria-hidden="true" className="size-4" />
            <code className="font-mono text-fd-foreground">prebuild: docs-overlay materialize</code>
            <ArrowRight aria-hidden="true" className="size-4" />
            <code className="font-mono text-fd-foreground">docusaurus build</code>
          </p>

          <p className="mt-4 text-center text-sm text-fd-muted-foreground">
            <code className="font-mono text-fd-foreground">docs/</code> becomes build output, which will surprise every contributor — so put{" "}
            <code className="font-mono text-fd-foreground">docs-overlay materialize --check</code> in CI. It turns an edit made there into a failed build
            instead of one that disappears without a trace.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
