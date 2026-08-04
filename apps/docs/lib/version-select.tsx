"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { VersionTab } from "docs-overlay-fumadocs";

import { versionOfPathname } from "@/lib/version-of-pathname";

/**
 * The version switcher lives in the app, not in `docs-overlay-fumadocs` — that package stays free of
 * React at runtime.
 *
 * It is handed an explicit list rather than relying on Fumadocs' automatic sidebar-tab detection,
 * which serialises every URL of every version into the client bundle.
 *
 * Which entry is current comes from the URL, not from a prop: the sidebar is rendered by a layout
 * that cannot see the page below it, so a value passed down would mark the same version current on
 * every route.
 */
export function VersionSelect({ tabs }: { tabs: readonly VersionTab[] }) {
  const current = versionOfPathname(usePathname(), tabs);

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
