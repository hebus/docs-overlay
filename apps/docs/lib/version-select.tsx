"use client";

import Link from "next/link";

import type { VersionTab } from "docs-overlay-fumadocs";

/**
 * The version switcher lives in the app, not in `docs-overlay-fumadocs` — that package stays free of
 * React at runtime.
 *
 * It is handed an explicit list rather than relying on Fumadocs' automatic sidebar-tab detection,
 * which serialises every URL of every version into the client bundle.
 */
export function VersionSelect({ tabs, current }: { tabs: readonly VersionTab[]; current: string }) {
  return (
    <nav aria-label="Documentation version" className="mb-4 flex flex-col gap-1 text-sm">
      {tabs.map(tab => (
        <Link
          key={tab.version}
          href={tab.url}
          aria-current={tab.version === current ? "page" : undefined}
          className={tab.version === current ? "font-semibold" : "opacity-70"}>
          {tab.title}
          {tab.isLatest ? " (latest)" : null}
        </Link>
      ))}
    </nav>
  );
}
