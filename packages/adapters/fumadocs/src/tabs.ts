import type { VersionId } from "@docs-overlay/core";
import type { Folder, Node, Root } from "fumadocs-core/page-tree";

import type { PageTreeReader } from "./diagnostics.js";
import type { OverlaySource } from "./overlay-source.js";
import type { VersionInfo } from "./version-info.js";

/**
 * The sidebar tree scoped to one version.
 *
 * Every version folder is marked `root: true`, so the page tree holds one folder per version. This
 * lifts the right one into a `Root` that `DocsLayout tree={...}` accepts.
 */
export function versionTree(output: Pick<PageTreeReader, "getPageTree">, segment: string, locale?: string): Root {
  const folder = findVersionFolder(output.getPageTree(locale).children, segment);

  if (folder === undefined) return { name: segment, children: [] };

  return {
    ...(folder.$id === undefined ? {} : { $id: folder.$id }),
    name: folder.name,
    ...(folder.description === undefined ? {} : { description: folder.description }),
    children: folder.children
  };
}

function findVersionFolder(nodes: readonly Node[], segment: string): Folder | undefined {
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    // `$ref.folder` is the virtual folder path, so it matches the segment exactly.
    if (node.$ref?.folder === segment) return node;
  }
  return undefined;
}

export interface VersionTab {
  readonly title: string;
  readonly url: string;
  readonly version: VersionId;
  readonly isLatest: boolean;
  readonly isChannel: boolean;
}

/**
 * Tabs for the version switcher, built from the version list.
 *
 * Deliberately **not** left to Fumadocs' automatic sidebar-tab detection: `getSidebarTabs()`
 * collects every URL of each `root: true` folder into a `Set` that is serialised into a client
 * component, which for ten versions of three hundred pages means about three thousand URLs shipped
 * on every page. `DocsLayout` accepts an explicit `tabs` array, so the payload stays proportional to
 * the number of versions instead.
 */
export function versionTabs(source: OverlaySource, options: { readonly newestFirst?: boolean | undefined } = {}): VersionTab[] {
  const tabs = source.versions.map(toTab);
  return options.newestFirst === false ? tabs : tabs.reverse();
}

function toTab(info: VersionInfo): VersionTab {
  return { title: info.label, url: info.url, version: info.id, isLatest: info.isLatest, isChannel: info.isChannel };
}
