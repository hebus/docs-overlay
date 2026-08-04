import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { reportDiagnostics, source } from "@/lib/source";

// Printed once per build, so a content problem in either product is visible in the log.
reportDiagnostics();

/**
 * The whole tree, both products included. Fumadocs narrows the sidebar to the `root: true` folder
 * holding the current page, and the adapter marks every version folder as one — so a reader sees the
 * version they are on, of the product they are in.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.getPageTree()} nav={{ title: "Two products", url: "/docs/alpha" }}>
      {children}
    </DocsLayout>
  );
}
