import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { versionTabs } from "docs-overlay-fumadocs";

import { baseOptions } from "@/lib/layout.shared";
import { overlay, reportDiagnostics, source } from "@/lib/source";
import { VersionSelect } from "@/lib/version-select";

// Printed once per build, so a completed navigation list or an unreachable page is visible in the log
// rather than discovered by a reader.
reportDiagnostics();

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      sidebar={{ banner: <VersionSelect tabs={versionTabs(overlay)} current={overlay.latest?.id ?? ""} /> }}>
      {children}
    </DocsLayout>
  );
}
