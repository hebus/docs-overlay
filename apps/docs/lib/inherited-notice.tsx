import { Callout } from "fumadocs-ui/components/callout";

import type { InheritedFrom } from "docs-overlay-fumadocs";

import { overlay } from "@/lib/source";

/**
 * Tells the reader that this page comes from an older version.
 *
 * Without it, inheritance is invisible: `/docs/next/authoring` and `/docs/authoring` render the same
 * file, and nothing in the page says which version wrote it.
 *
 * No link to that version — it would lead to the very same prose. And no `"use client"`: unlike the
 * version switcher, this has the route handed to it rather than reading the URL.
 */
export function InheritedNotice({ from }: { from: InheritedFrom }) {
  // Fall back to the raw id: a missing label is no reason to withhold the fact.
  const label = overlay.versionOf(from.version)?.label ?? from.version;

  // One template string, not `Unchanged since {label}`: React separates adjacent text nodes with a
  // comment, and the sentence would reach the HTML as `Unchanged since <!-- -->0.1.0` — unsearchable.
  return (
    <Callout type="info" data-testid="inherited-notice">
      {`Unchanged since ${label}`}
    </Callout>
  );
}
