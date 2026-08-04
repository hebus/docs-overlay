import type { ReactNode } from "react";

import { versionTabs } from "docs-overlay-fumadocs";

import { SearchRootProvider } from "@/lib/search-provider";
import { overlay } from "@/lib/source";

import "./global.css";

// Read at build time, from the same variable `next.config.mjs` gives to `basePath`: the search index
// is fetched by URL, and the client half of Next does not expose the base path.
const basePath = process.env.BASE_PATH ?? "";

const tabs = versionTabs(overlay);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <SearchRootProvider basePath={basePath} tabs={tabs}>
          {children}
        </SearchRootProvider>
      </body>
    </html>
  );
}
