import { ArrowRight } from "lucide-react";

import { Reveal } from "./reveal";

export function ReleaseCut() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Reveal>
        <article className="h-full rounded-xl border border-fd-border bg-fd-card/50 p-6">
          <p className="text-sm font-medium text-fd-muted-foreground">Snapshot versioning</p>

          <pre className="mt-4 overflow-x-auto rounded-lg bg-fd-secondary/60 p-3 font-mono text-xs leading-5 text-fd-muted-foreground">
            cp -r docs/ versioned_docs/version-11.15.0/
          </pre>

          <ul className="mt-5 space-y-2 text-sm text-fd-muted-foreground">
            <li>~190 files copied, a ~1.2 MB commit</li>
            <li>The sidebar duplicated alongside them</li>
            <li>A typo now lives in every copy</li>
            <li>Deleting a page means editing frozen folders by hand</li>
          </ul>
        </article>
      </Reveal>

      <Reveal delay={0.08}>
        <article className="relative h-full overflow-hidden rounded-xl border border-do-accent/35 bg-fd-card p-6">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-do-accent to-do-accent-2" />

          <p className="text-sm font-medium text-do-accent">Overlay versioning</p>

          <pre className="mt-4 overflow-x-auto rounded-lg bg-fd-secondary/60 p-3 font-mono text-xs leading-5 text-fd-foreground">
            git mv content/docs/next content/docs/11.15.0{"\n"}mkdir content/docs/next
          </pre>

          <ul className="mt-5 space-y-2 text-sm text-fd-muted-foreground">
            <li>Git records it as renames — a zero-byte content diff</li>
            <li>The emptied channel inherits everything again</li>
            <li>Nothing was duplicated, so nothing can drift</li>
            <li>Removals and renames are declarative frontmatter</li>
          </ul>
        </article>
      </Reveal>

      <Reveal delay={0.14} className="lg:col-span-2">
        <p className="flex flex-wrap items-center justify-center gap-4 rounded-xl border border-fd-border bg-fd-card/50 px-6 py-8 text-center">
          <span className="font-mono text-2xl text-fd-muted-foreground line-through decoration-fd-diff-remove-symbol/70 sm:text-3xl">~190 files</span>
          <ArrowRight aria-hidden="true" className="size-5 text-fd-muted-foreground" />
          <span className="bg-gradient-to-r from-do-accent to-do-accent-2 bg-clip-text font-mono text-2xl font-semibold text-transparent sm:text-3xl">
            0 bytes
          </span>
        </p>
      </Reveal>
    </div>
  );
}
