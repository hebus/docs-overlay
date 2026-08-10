/**
 * Reading the `overlay:` block out of Docusaurus frontmatter.
 *
 * The engine's `defaultReadDirectives` looks for `meta.overlay`, but a Docusaurus entry's metadata is a
 * parsed frontmatter object, so the block sits one level down. Wiring that up by hand is a two-line job
 * and easy to get subtly wrong: skipping `normaliseDirectives` leaves `renamedFrom: guide/old-api` — a
 * bare string where a list is expected — unrecognised, and nothing reports it, because a directive the
 * engine cannot read is indistinguishable from a directive nobody wrote.
 *
 * Which is the same failure mode the Fumadocs adapter guards with `withOverlay()`: there a strict zod
 * schema strips the key before it arrives, here a hand-rolled reader drops it. Both are silent, so both
 * get a named function.
 */

import type { ContentEntry, OverlayDirectives, ReadDirectivesFn } from "docs-overlay";
import { normaliseDirectives } from "docs-overlay";

/** Metadata shape this reader expects: whatever the caller parsed, under `frontMatter`. */
export interface WithFrontMatter {
  readonly frontMatter?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Pass to `createOverlay({ readDirectives })`.
 *
 * Permissive on purpose, and the permissiveness is the engine's, not ours: `normaliseDirectives` accepts
 * a bare string where a list belongs and tolerates leading or trailing slashes, so an author writing
 * `renamedFrom: /guide/old-api` gets what they meant.
 */
export function readDocusaurusDirectives<M extends WithFrontMatter>(): ReadDirectivesFn<M> {
  return (entry: ContentEntry<M>): OverlayDirectives | undefined => normaliseDirectives(entry.meta.frontMatter?.["overlay"]);
}

/**
 * Strips the `overlay:` block from a frontmatter block's text.
 *
 * Not needed by default: Docusaurus validates doc frontmatter with a Joi schema declared `.unknown()`,
 * so an `overlay:` key passes through untouched, and copying a page's bytes verbatim is what keeps its
 * line endings, encoding and MDX imports intact. This exists for a caller who would rather not ship the
 * directive to the reader, and it is line-based so it is the exact inverse of inserting the block.
 */
export function withoutOverlayBlock(text: string): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(eol);
  if (lines[0] !== "---") return text;

  const end = lines.indexOf("---", 1);
  if (end === -1) return text;

  const kept: string[] = [];
  let inside = false;
  for (const [index, line] of lines.entries()) {
    if (index > 0 && index < end) {
      if (/^overlay:\s*$/.test(line)) {
        inside = true;
        continue;
      }
      // A nested key is indented; the first line that is not tells us the block ended.
      if (inside && /^\s+\S/.test(line)) continue;
      inside = false;
    }
    kept.push(line);
  }
  return kept.join(eol);
}
