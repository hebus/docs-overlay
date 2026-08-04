import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { versionTabs } from "docs-overlay-fumadocs";

import { baseOptions } from "@/lib/layout.shared";
import { overlay, reportDiagnostics, source } from "@/lib/source";
import { VersionSelect } from "@/lib/version-select";

// Once per build: a completed navigation list or an unreachable page shows up in the log, and a
// content error stops the build outright.
reportDiagnostics();

const tabs = versionTabs(overlay);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      // Only shown once there is more than one version to choose between. The `key` is not
      // decoration: `Sidebar` drops the banner into an array of children, and React only exempts
      // children created in that same call from needing one.
      sidebar={tabs.length > 1 ? { banner: <VersionSelect key="version-select" tabs={tabs} current={overlay.latest?.id ?? ""} /> } : undefined}>
      {children}
    </DocsLayout>
  );
}
