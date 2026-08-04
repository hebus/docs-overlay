import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Reveal } from "./reveal";

export function Proof() {
  return (
    <Reveal>
      <div className="relative overflow-hidden rounded-2xl border border-fd-border bg-fd-card px-6 py-10 sm:px-10">
        <div aria-hidden="true" className="do-grid absolute inset-0 opacity-60" />

        <div className="relative max-w-2xl">
          <p className="font-mono text-xs tracking-[0.18em] text-do-accent uppercase">Its own proof</p>

          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">You are reading documentation served by docs-overlay.</h2>

          <p className="mt-4 text-fd-muted-foreground">
            The releases and the <code className="rounded bg-fd-secondary px-1.5 py-0.5 font-mono text-sm">next</code> channel are listed in the sidebar. The
            channel folder holds only the pages an unreleased change has rewritten — often none at all. Every other page it serves is the release&apos;s file of
            the same name, and says which version wrote it.
          </p>

          <Link href="/docs" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-do-accent transition-opacity hover:opacity-80">
            Switch between the versions
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
