/**
 * Runs the engine's diagnostics without a build.
 *
 * `overlay.diagnostics()` is otherwise reachable only through one, which means a content mistake costs a
 * full Next or Docusaurus compile to discover. This is the same information in a second, so it can sit in
 * a pre-commit hook — and with the generic dialect it needs no framework adapter installed at all.
 */

import { dialectMismatch, genericDialect, type SiteDialect } from "../dialect.js";
import { fail, formatDiagnostics, hasErrors, say, uniqueDiagnostics } from "../log.js";
import { readSite } from "../site.js";

export interface CheckArgs {
  readonly contentDir: string;
  readonly channels: readonly string[];
  readonly json: boolean;
  readonly failOn: "error" | "warning";
  /** Conventions to read the tree with. Omitted reads it generically — see `readSite`. */
  readonly dialect?: SiteDialect | undefined;
  /** Why that dialect, printed so a wrong guess is visible rather than silent. */
  readonly dialectReason?: string | undefined;
  /** `true` when the dialect was named rather than detected, which is what makes it final. */
  readonly dialectRequested?: boolean | undefined;
}

export function checkCommand(args: CheckArgs): number {
  const dialect = args.dialect ?? genericDialect;
  const site = readSite({ contentDir: args.contentDir, channels: args.channels, dialect });

  // Before anything is reported, because everything reported below is expressed in slugs, and slugs
  // derived with the wrong dialect make the whole output describe a site that does not exist.
  const mismatch = dialectMismatch(site.foreignMetaFiles, dialect, args.dialectRequested);
  if (mismatch !== undefined) {
    fail(mismatch);
    return 1;
  }

  // `diagnostics()` materialises every version, so the answer is complete rather than whatever happened
  // to be folded already. `site.diagnostics` adds the file-level problems the engine never sees — a
  // sidebar that is not valid JSON, frontmatter that is not valid YAML — and repeats everything the
  // engine already reported, hence the deduplication.
  const diagnostics = uniqueDiagnostics([...site.diagnostics, ...site.overlay.diagnostics()]);

  if (args.json) {
    say(
      JSON.stringify(
        { dialect: dialect.name, dialectReason: args.dialectReason, versions: site.overlay.versions.map(version => version.id), diagnostics },
        undefined,
        2
      )
    );
  } else {
    const versions = site.overlay.versions.map(version => version.id).join(", ");
    say(`dialect    ${dialect.name}${args.dialectReason === undefined ? "" : `  (${args.dialectReason})`}`);
    say(`${site.entries.length} entr${site.entries.length === 1 ? "y" : "ies"} across ${site.overlay.versions.length} version(s): ${versions}`);
    say("");
    say(formatDiagnostics(diagnostics));
  }

  if (args.failOn === "warning" && diagnostics.length > 0) return 1;
  return hasErrors(diagnostics) ? 1 : 0;
}
