import { FilePlus2, FilePen, Signpost, Trash2 } from "lucide-react";

import { Reveal } from "./reveal";

const OPERATIONS = [
  {
    icon: FilePen,
    title: "Change a page",
    how: "The new file, nothing else.",
    accent: "add" as const,
    code: `---
title: Intro
---`
  },
  {
    icon: FilePlus2,
    title: "Add a page",
    how: "A file the older versions do not have.",
    accent: "add" as const,
    code: `---
title: New API
---`
  },
  {
    icon: Signpost,
    title: "Rename a page",
    how: "The old slug keeps answering — with a redirect from this version on.",
    accent: "add" as const,
    code: `---
title: New API
overlay:
  renamedFrom: guide/old-api
---`
  },
  {
    icon: Trash2,
    title: "Delete a page",
    how: "A tombstone at the same path. Readers get an explanation, not a 404.",
    accent: "remove" as const,
    code: `---
title: Old API
overlay:
  deleted: true
  replacedBy: guide/new-api
---`
  }
];

export function Operations() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {OPERATIONS.map((operation, index) => (
          <Reveal key={operation.title} delay={index * 0.06}>
            <article className="flex h-full flex-col gap-4 rounded-xl border border-fd-border bg-fd-card p-5">
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg ${operation.accent === "add" ? "bg-fd-diff-add text-fd-diff-add-symbol" : "bg-fd-diff-remove text-fd-diff-remove-symbol"}`}>
                  <operation.icon className="size-4.5" />
                </span>
                <h3 className="font-semibold">{operation.title}</h3>
              </div>

              <p className="text-sm text-fd-muted-foreground">{operation.how}</p>

              <pre className="mt-auto overflow-x-auto rounded-lg bg-fd-secondary/60 p-3 font-mono text-xs leading-5 text-fd-muted-foreground">
                {operation.code}
              </pre>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <p className="mt-8 max-w-3xl text-sm text-fd-muted-foreground">
          All four are expressed <strong className="font-medium text-fd-foreground">in the version that introduces them</strong>, so a published folder is never
          touched again. Which means a release pull request is reviewable:{" "}
          <code className="rounded bg-fd-secondary px-1.5 py-0.5 font-mono text-xs">grep -rl &apos;deleted: true&apos; content/docs/3.0.0/</code> lists exactly
          what disappears.
        </p>
      </Reveal>
    </>
  );
}
