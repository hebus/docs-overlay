import { Boxes, FolderTree, Package, Route, ShieldCheck, Zap } from "lucide-react";

import { Reveal } from "./reveal";

const FEATURES = [
  {
    icon: Package,
    title: "Zero dependencies",
    text: "The engine is a plain TypeScript library: no npm dependency, no node: built-in, no framework. An architecture test and a packaged run with no node_modules at all keep it that way."
  },
  {
    icon: FolderTree,
    title: "No versions.json",
    text: "The list of versions is the list of folders, ordered by semver, with declared channels sorted last. Nothing to keep in sync, nothing that can drift."
  },
  {
    icon: Route,
    title: "URLs that survive a migration",
    text: "latestAtRoot gives the Docusaurus URL shape — /docs/guide/a is the newest release, /docs/11.13.0/guide/a an older one. No external link breaks."
  },
  {
    icon: ShieldCheck,
    title: "Problems fail the build",
    text: "An unreachable page, a rename pointing nowhere, a navigation list that lost an entry: each is a diagnostic you can turn into a failed build rather than a reader's dead end."
  },
  {
    icon: Zap,
    title: "Incremental by design",
    text: "getDependents() answers which versions a changed file actually feeds, so invalidate() rebuilds those and nothing else."
  },
  {
    icon: Boxes,
    title: "Several products, one site",
    text: "Scopes let each product carry its own versions, its own channel and its own overlay chain, all behind a single loader()."
  }
];

export function FeatureGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature, index) => (
        <Reveal key={feature.title} delay={index * 0.05}>
          <article className="group h-full rounded-xl border border-fd-border bg-fd-card p-5 transition-colors hover:border-do-accent/40">
            <feature.icon className="size-5 text-do-accent" />
            <h3 className="mt-4 font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm text-fd-muted-foreground">{feature.text}</p>
          </article>
        </Reveal>
      ))}
    </div>
  );
}
