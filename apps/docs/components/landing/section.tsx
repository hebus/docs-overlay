import type { ReactNode } from "react";

import { Reveal } from "./reveal";

interface SectionProps {
  id?: string;
  kicker?: string;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ id, kicker, title, lead, children, className }: SectionProps) {
  return (
    <section id={id} className={`border-t border-fd-border px-6 py-20 lg:py-28 ${className ?? ""}`}>
      <div className="mx-auto max-w-5xl">
        <Reveal>
          {kicker ? <p className="mb-3 font-mono text-xs tracking-[0.18em] text-do-accent uppercase">{kicker}</p> : null}
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
          {lead ? <p className="mt-4 max-w-2xl text-lg text-pretty text-fd-muted-foreground">{lead}</p> : null}
        </Reveal>

        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
