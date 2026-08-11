/**
 * Writes the tree Docusaurus reads, or checks that it is already the right one.
 *
 * The adapter decides *what* the tree should contain; this decides *whether to touch the disk*. Keeping
 * that split means every rule about not destroying somebody's files lives in one place (`io.ts`) and
 * every rule about Docusaurus lives in another.
 */

import type { Diagnostic } from "docs-overlay";
import type { DocusaurusMeta } from "docs-overlay-docusaurus";
import { join } from "node:path";

import { resolveDialect, type SiteDialect } from "../dialect.js";
import { assertWritable, readBytes, reconcile, type PlannedFile } from "../io.js";
import { fail, formatDiagnostics, hasErrors, say, uniqueDiagnostics } from "../log.js";
import { readSite } from "../site.js";

export interface MaterializeArgs {
  readonly siteDir: string;
  readonly contentDir: string;
  readonly outDir: string;
  readonly channels: readonly string[];
  readonly routeBasePath: string;
  readonly labels: Readonly<Record<string, string>>;
  /** Classes for sidebar entries a version adds / changes. Absent leaves generated sidebars unmarked. */
  readonly markAdded?: string | undefined;
  readonly markChanged?: string | undefined;
  readonly check: boolean;
  readonly clean: boolean;
  readonly json: boolean;
  readonly allowErrors: boolean;
  /**
   * Must be the Docusaurus dialect: this command writes a Docusaurus tree, and no other framework has
   * an equivalent to write. Typed loosely on purpose — naming the adapter's own types in an exported
   * signature would put `docs-overlay-docusaurus` in this package's declarations, making an optional
   * peer dependency mandatory for anyone typechecking against it.
   */
  readonly dialect?: SiteDialect | undefined;
  /** Why that dialect, kept for symmetry with the other commands. */
  readonly dialectReason?: string | undefined;
  /** `true` when the dialect was named rather than detected, which changes what a refusal should advise. */
  readonly dialectRequested?: boolean | undefined;
}

export async function materializeCommand(args: MaterializeArgs): Promise<number> {
  if (args.dialect !== undefined && args.dialect.name !== "docusaurus") {
    // The two cases read very differently to whoever is stuck. Asking for `--dialect generic` and being
    // refused is a contradiction to point out; getting here without asking for anything means the site
    // does not look like a Docusaurus one, and the useful answer is *why it was not detected*.
    fail(
      `This command writes the tree Docusaurus reads, so it cannot run with the ${args.dialect.name} dialect.\n\n` +
        (args.dialectRequested === true
          ? "Drop --dialect to let the site's own configuration decide, or pass --dialect docusaurus.\n"
          : `No docusaurus.config.* was found, so this was read as a ${args.dialect.name} tree — and there is no\n` +
            "Docusaurus site here to write into. Point --site-dir at the site, or install the adapter if this\n" +
            "is one:\n\n  npm install docs-overlay-docusaurus\n")
    );
    return 1;
  }

  // Resolved here when the caller did not pass one, so calling this as a function needs no more setup
  // than calling it from the bin. `resolveDialect` throws the actionable "npm install" message when the
  // adapter is absent, which is the one thing this command cannot do without.
  const dialect = args.dialect ?? (await resolveDialect(args.siteDir, "docusaurus")).dialect;

  // Awaited rather than statically imported so that nothing else in this bundle pulls the adapter in.
  // No `catch` and no fallback: the dialect above only exists because `resolveDialect` already imported
  // this module successfully, so it is in the module cache and this resolves from memory.
  const adapter = await import("docs-overlay-docusaurus");

  const diagnostics: Diagnostic[] = [];
  const site = readSite<DocusaurusMeta>({
    contentDir: args.contentDir,
    channels: args.channels,
    // Narrowed, not reinterpreted: the check above established this is the Docusaurus dialect, whose
    // navigation parser produces the adapter's own metadata. `SiteMeta` is the loose shape the exported
    // signature can afford to name; this is the precise one, and only this module can say so.
    dialect: dialect as SiteDialect<DocusaurusMeta>,
    onDiagnostic: diagnostic => diagnostics.push(diagnostic)
  });

  const marks = args.markAdded === undefined && args.markChanged === undefined ? undefined : { added: args.markAdded, changed: args.markChanged };

  const plan = adapter.materialize(site.overlay, {
    routeBasePath: args.routeBasePath,
    outDir: args.outDir,
    labels: args.labels,
    changeClassNames: marks,
    onDiagnostic: diagnostic => diagnostics.push(diagnostic)
  });

  // Refused before a single byte is written, and refused rather than adopted: these are the paths a
  // pre-migration site kept under source control, so writing into an unrecognised one would delete
  // somebody's committed documentation on the next run.
  try {
    assertWritable(args.siteDir, plan.directories);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const files: PlannedFile[] = plan.files.map(file =>
    file.kind === "copy" ? { path: file.path, bytes: readBytes(file.from), from: file.from } : { path: file.path, bytes: Buffer.from(file.contents, "utf8") }
  );

  // The docs plugin block travels in the manifest so both of a site's config files read it rather than
  // each declaring `lastVersion` and `versions` for themselves. `changes` travels with it because the
  // entries the adapter cannot reach — the ones inside an `autogenerated` block — are marked by the site's
  // own `sidebarItemsGenerator`, and it needs the same two sets to do it from.
  const result = reconcile(args.siteDir, args.outDir, plan.directories, files, {
    check: args.check,
    clean: args.clean,
    payload: { docs: plan.docsOptions, versions: plan.versions, changes: plan.changes }
  });

  // The sink caught the file-level problems the plan knows nothing about; the plan's own list is complete
  // for the engine. Both are wanted, and their overlap is reported once. Computed before the output so
  // `--json` and the text form describe the same set — previously the JSON carried only the plan's.
  const all = uniqueDiagnostics([...diagnostics, ...plan.diagnostics]);

  if (args.json) {
    say(JSON.stringify({ ...result, versions: plan.versions, docsOptions: plan.docsOptions, diagnostics: all }, undefined, 2));
  } else {
    const versions = plan.versions.map(version => `${version.id}${version.path === "" ? " (root)" : ` → /${version.path}`}`).join(", ");
    say(`versions   ${versions}`);
    say(`files      ${files.length} planned · ${result.written.length} ${args.check ? "would change" : "written"} · ${result.unchanged.length} unchanged`);
    // The oldest version has no predecessor, so it reports nothing rather than reporting its whole tree.
    const moved = plan.changes.filter(change => change.added.length > 0 || change.changed.length > 0);
    if (moved.length > 0)
      say(`changes    ${moved.map(change => `${change.version}: +${change.added.length} added · ${change.changed.length} changed`).join(" · ")}`);
    if (result.removed.length > 0) say(`removed    ${result.removed.length} file(s) a previous run wrote and this one does not`);
    // The one mistake a Docusaurus contributor will make, because editing `docs/` is muscle memory.
    // Better a noisy warning than an edit that disappears at the next build without a trace.
    for (const path of result.tampered) say(`edited by hand, overwritten: ${path} — edit the content directory instead`);
  }

  if (all.length > 0 && !args.json) say(`\n${formatDiagnostics(all)}`);

  if (args.check && result.written.length + result.removed.length > 0) {
    fail(`The generated tree is out of date. Run \`docs-overlay materialize\` (${result.written.length} to write, ${result.removed.length} to remove).`);
    return 1;
  }
  if (hasErrors(all) && !args.allowErrors) {
    fail("Refusing to finish with content errors. Fix them, or pass --allow-errors.");
    return 1;
  }
  return 0;
}

/** Where the generated current-version tree lives, for a caller wiring `docs.path`. */
export const currentDirOf = (outDir: string): string => join(outDir, "current");
