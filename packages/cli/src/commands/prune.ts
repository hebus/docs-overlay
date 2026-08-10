/**
 * Removes files a version repeats verbatim from what it inherits.
 *
 * The migration does this once, but it is not a one-off: anything that writes into a version folder
 * wholesale — a script mirroring documentation out of a library repository, a bulk copy, a backport onto
 * another branch — recreates an override for every file it touches, including the ones identical to what
 * they would inherit. Nothing breaks, so nothing reports it; the repository just quietly re-inflates and
 * the overlay stops meaning anything.
 *
 * It is also what makes a backport affordable. The set of identical files depends on the branch's own
 * content, so it cannot be replayed from a commit — it has to be recomputed, and that means a command
 * rather than a list.
 */

import { slugKey, type Slug, type VersionId } from "docs-overlay";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { fail, say } from "../log.js";
import { readSite } from "../site.js";

export interface PruneArgs {
  readonly contentDir: string;
  readonly channels: readonly string[];
  /** Version to prune. Omitted prunes every version except the oldest, which has nothing to inherit. */
  readonly version: VersionId | undefined;
  readonly dryRun: boolean;
  readonly useGit: boolean;
  readonly json: boolean;
}

export function pruneCommand(args: PruneArgs): number {
  const site = readSite({ contentDir: args.contentDir, channels: args.channels });
  const versions = site.overlay.versions;

  if (versions.length === 0) {
    fail(`no version folders under ${args.contentDir}.`);
    return 1;
  }

  if (args.version !== undefined && site.overlay.getVersion(args.version) === undefined) {
    fail(`unknown version "${args.version}". Known: ${versions.map(version => version.id).join(", ")}.`);
    return 1;
  }

  // The oldest version is the base — it inherits nothing, so every file it holds is load-bearing.
  const targets = (args.version === undefined ? versions.slice(1) : versions.filter(version => version.id === args.version)).filter(
    version => version.inheritsFrom !== undefined
  );

  const redundant: { readonly version: VersionId; readonly path: string; readonly inheritedFrom: VersionId }[] = [];

  for (const version of targets) {
    const parent = version.inheritsFrom;
    if (parent === undefined) continue;

    for (const page of site.overlay.getPages(version.id)) {
      // Only this version's own files can be pruned; an inherited one is not there to remove.
      if (page.inherited) continue;

      // A file carrying a directive is kept even when its bytes match: pruning it would delete the
      // rename or the alias with it, and the slug would stop answering.
      const directives = page.meta.frontMatter?.["overlay"];
      if (directives !== undefined && directives !== null) continue;

      const inherited = site.overlay.resolve(parent, page.slug);
      if (inherited.kind !== "own" && inherited.kind !== "inherited") continue;

      const ownPath = site.origins.get(page.source.path);
      const parentPath = site.origins.get(inherited.page.source.path);
      if (ownPath === undefined || parentPath === undefined) continue;
      if (!existsSync(ownPath) || !existsSync(parentPath)) continue;

      // Raw bytes, not text: a difference that is only a line ending is still a difference, and treating
      // it as one would rewrite the file during a prune.
      if (!readFileSync(ownPath).equals(readFileSync(parentPath))) continue;

      redundant.push({ version: version.id, path: page.source.path, inheritedFrom: inherited.page.source.definedIn });
    }
  }

  redundant.sort((a, b) => a.path.localeCompare(b.path));

  if (args.json) {
    say(JSON.stringify({ redundant, dryRun: args.dryRun }, undefined, 2));
  } else if (redundant.length === 0) {
    say(`nothing to prune: no version repeats a file its parent already serves.`);
  } else {
    const byVersion = new Map<VersionId, number>();
    for (const entry of redundant) byVersion.set(entry.version, (byVersion.get(entry.version) ?? 0) + 1);
    say(`${redundant.length} file(s) identical to what they inherit:`);
    for (const [version, count] of byVersion) say(`  ${version}  ${count}`);
    // Listed without a verb: this is what was *found*. Saying "removed" here would be a lie whenever the
    // removal below fails — `git rm` refuses a file with staged or local changes, which is exactly the state
    // a migration is in when it prunes.
    for (const entry of redundant) say(`  ${entry.path}  (inherits ${entry.inheritedFrom})`);
  }

  if (args.dryRun || redundant.length === 0) {
    if (args.dryRun && redundant.length > 0) say(`\nnothing removed: --dry-run.`);
    return 0;
  }

  const paths = redundant.map(entry => join(args.contentDir, entry.version, restOf(entry.path)));
  if (args.useGit) {
    // `git rm` rather than unlink, so the removal is staged as a removal and the caller does not have to
    // notice it afterwards.
    try {
      execFileSync("git", ["rm", "-q", "--", ...paths], { stdio: "inherit" });
    } catch {
      fail(
        "`git rm` failed, and nothing was removed.\n\n" +
          "It refuses a file that has staged or local changes — the usual state mid-migration. Commit what\n" +
          "you have and run this again, or use --no-git to unlink the files without staging the removal.\n"
      );
      return 1;
    }
  } else {
    for (const path of paths) if (existsSync(path)) unlinkSync(path);
  }

  say(`\nremoved ${paths.length} file(s); those slugs are now served by inheritance.`);
  say(`Run \`docs-overlay check\` to confirm nothing else moved.`);
  return 0;
}

const restOf = (path: string): string => path.slice(path.indexOf("/") + 1);

/** Slug of each entry, for a caller that wants to report rather than remove. */
export const slugsOf = (entries: readonly { readonly path: string }[], slugify: (path: string) => Slug): readonly string[] =>
  entries.map(entry => slugKey(slugify(restOf(entry.path))));
