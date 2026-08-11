import { Reveal } from "./reveal";

/**
 * The four commands, as they are — not as a roadmap.
 *
 * The landing page did not name the command line at all, which left the one thing a reader can run
 * before installing anything invisible.
 */
const COMMANDS = [
  {
    command: "docs-overlay cut 2.0.0",
    text: "The channel folder becomes that version and comes back empty, inheriting everything again. A git mv, so the content diff is zero bytes."
  },
  {
    command: "docs-overlay check",
    text: "The engine's diagnostics in seconds, with no framework build: duplicate slugs, a tombstone with nothing to remove, a redirect that goes nowhere."
  },
  {
    command: "docs-overlay prune",
    text: "Drops the files a version repeats byte for byte from what it inherits. The resolved site is identical afterwards — the slug is simply served by inheritance."
  },
  {
    command: "docs-overlay materialize",
    text: "Writes the tree Docusaurus reads, as a prebuild step. --check writes nothing and fails when the generated tree is out of date."
  }
];

export function CliCommands() {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-fd-border bg-fd-border sm:grid-cols-2">
      {COMMANDS.map((entry, index) => (
        <Reveal key={entry.command} delay={index * 0.05} className="bg-fd-card p-5">
          <p className="font-mono text-sm font-medium text-do-accent">{entry.command}</p>
          <p className="mt-2 text-sm text-fd-muted-foreground">{entry.text}</p>
        </Reveal>
      ))}
    </div>
  );
}
