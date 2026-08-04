"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RootProvider } from "fumadocs-ui/provider/next";

import type { VersionTab } from "docs-overlay-fumadocs";

import { versionOfPathname } from "@/lib/version-of-pathname";

/**
 * `RootProvider` with the search dialog wired for a static export.
 *
 * Two defaults are wrong for this site:
 *
 * - The dialog queries `/api/search?query=…` per keystroke, which needs a server at request time.
 *   `type: "static"` downloads the exported index once and searches in the browser instead.
 * - That download ignores the base path. Fumadocs reads it from `import.meta.env.BASE_URL`, which
 *   only Vite defines — under Next it is always `/`, so on Pages the request would leave the site
 *   entirely and hit `hebus.github.io/api/search`. Hence the explicit `api`.
 *
 * `defaultTag` scopes results to the version being read: the index holds one entry per version
 * serving a page, and an unfiltered query returns all of them.
 */
export function SearchRootProvider({ basePath, tabs, children }: { basePath: string; tabs: readonly VersionTab[]; children: ReactNode }) {
  const version = versionOfPathname(usePathname(), tabs);

  return (
    <RootProvider
      search={{
        options: {
          type: "static",
          api: `${basePath}/api/search`,
          ...(version === undefined ? {} : { defaultTag: version })
        }
      }}>
      {children}
    </RootProvider>
  );
}
