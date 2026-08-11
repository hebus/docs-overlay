/**
 * Runs the engine's diagnostics with no framework in the loop.
 *
 * `overlay.diagnostics()` is otherwise reachable only through a build, which means a content mistake
 * costs a full Next or Docusaurus compile to discover. This is the same information in a second, so it
 * can sit in a pre-commit hook.
 */

import { formatDiagnostics, hasErrors, say, uniqueDiagnostics } from "../log.js";
import { readSite } from "../site.js";

export interface CheckArgs {
  readonly contentDir: string;
  readonly channels: readonly string[];
  readonly json: boolean;
  readonly failOn: "error" | "warning";
}

export function checkCommand(args: CheckArgs): number {
  const site = readSite({ contentDir: args.contentDir, channels: args.channels });
  // `diagnostics()` materialises every version, so the answer is complete rather than whatever happened
  // to be folded already. `site.diagnostics` adds the file-level problems the engine never sees — a
  // sidebar that is not valid JSON, frontmatter that is not valid YAML — and repeats everything the
  // engine already reported, hence the deduplication.
  const diagnostics = uniqueDiagnostics([...site.diagnostics, ...site.overlay.diagnostics()]);

  if (args.json) {
    say(JSON.stringify({ versions: site.overlay.versions.map(version => version.id), diagnostics }, undefined, 2));
  } else {
    const versions = site.overlay.versions.map(version => version.id).join(", ");
    say(`${site.entries.length} entr${site.entries.length === 1 ? "y" : "ies"} across ${site.overlay.versions.length} version(s): ${versions}`);
    say("");
    say(formatDiagnostics(diagnostics));
  }

  if (args.failOn === "warning" && diagnostics.length > 0) return 1;
  return hasErrors(diagnostics) ? 1 : 0;
}
