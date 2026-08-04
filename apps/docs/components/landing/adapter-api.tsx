import { Reveal } from "./reveal";

const API = [
  {
    symbol: "overlaySource()",
    text: "Wraps the source Fumadocs already built. A single loader() then serves every version — one page tree, one search index."
  },
  {
    symbol: "resolveRoute()",
    text: "Turns the catch-all params into a decision: page, redirect, gone, or not-found — with inheritedFrom naming the version that wrote the page."
  },
  {
    symbol: "staticParams()",
    text: "Generates every routable URL, aliases and removed pages included. source.generateParams() knows only pages, and on a static host a missing route is a 404, not a redirect."
  },
  {
    symbol: "versionTabs() · switchVersion()",
    text: "A version picker that falls back cleanly when the page does not exist in the version being switched to."
  },
  {
    symbol: "searchTagsOf()",
    text: "Scopes the search index per version. Without it, a page served by five versions returns five identical results."
  },
  {
    symbol: "findOrphanPages() · diagnostics",
    text: "An unreachable page or a broken directive fails the build instead of shipping quietly to the reader."
  }
];

export function AdapterApi() {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-fd-border bg-fd-border sm:grid-cols-2">
      {API.map((entry, index) => (
        <Reveal key={entry.symbol} delay={index * 0.05} className="bg-fd-card p-5">
          <p className="font-mono text-sm font-medium text-do-accent">{entry.symbol}</p>
          <p className="mt-2 text-sm text-fd-muted-foreground">{entry.text}</p>
        </Reveal>
      ))}
    </div>
  );
}
