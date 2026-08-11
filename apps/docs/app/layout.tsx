import type { Metadata } from "next";
import type { ReactNode } from "react";

import { versionTabs } from "docs-overlay-fumadocs";

import { basePath } from "@/lib/base-path";
import { SearchRootProvider } from "@/lib/search-provider";
import { overlay } from "@/lib/source";

import "./global.css";

const tabs = versionTabs(overlay);

const DESCRIPTION =
  "Version your documentation without duplicating it: each version folder holds only what changed — an override, a new page, a rename, or a tombstone. A framework-agnostic engine, with adapters for Fumadocs and Docusaurus.";

export const metadata: Metadata = {
  // Trailing slash, and it matters: without one, `new URL()` treats `/docs-overlay` as a file rather than
  // a directory, so every relative metadata URL resolves to the host root and lands outside the site.
  metadataBase: new URL("https://hebus.github.io/docs-overlay/"),
  title: { default: "docs-overlay — write the diff, not the docs", template: "%s — docs-overlay" },
  description: DESCRIPTION,
  applicationName: "docs-overlay",
  keywords: [
    "documentation versioning",
    "versioned documentation",
    "documentation",
    "versioning",
    "docs",
    "fumadocs",
    "docusaurus",
    "monorepo",
    "markdown",
    "mdx",
    "nextjs",
    "typescript",
    "overlay"
  ],
  openGraph: {
    type: "website",
    siteName: "docs-overlay",
    // Relative, so `metadataBase` supplies the origin and the base path in one place.
    url: "/",
    title: "docs-overlay — write the diff, not the docs",
    description: DESCRIPTION
  },
  twitter: { card: "summary", title: "docs-overlay — write the diff, not the docs", description: DESCRIPTION }
};

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
