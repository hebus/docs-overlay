/**
 * Cuts a release: the channel folder becomes the version that was just published.
 *
 * Generalised from the script this repository already runs on itself. The four refusals are kept
 * verbatim in spirit, because each one describes a way of losing content quietly, and a fifth is added
 * that the Mint migration ran into for real.
 */

import { isStableSemver, parseSemver } from "docs-overlay";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fail, say } from "../log.js";

export interface CutArgs {
  readonly contentDir: string;
  readonly version: string;
  readonly channel: string;
  readonly dryRun: boolean;
  readonly useGit: boolean;
}

export function cutCommand(args: CutArgs): number {
  const channel = join(args.contentDir, args.channel);
  const target = join(args.contentDir, args.version);

  // A folder the engine cannot read as a version is reported as `unknown-version-folder` at *warning*
  // severity, so the build would pass and the whole cut would vanish from the site without a word.
  // Refusing to cut is the lesser failure.
  if (parseSemver(args.version) === undefined) {
    fail(`refusing to cut: "${args.version}" is not a name the engine would read as a version.`);
    return 1;
  }
  if (!isStableSemver(args.version)) {
    say(`note: "${args.version}" is a prerelease, so it will sort before the release of the same number.`);
  }
  if (!existsSync(channel)) {
    fail(`nothing to cut: there is no ${args.channel}/ channel in ${args.contentDir}.`);
    return 1;
  }
  if (existsSync(target)) {
    fail(`nothing to do: ${args.version}/ already exists.`);
    return 1;
  }

  const pending = readdirSync(channel).filter(name => name !== ".gitkeep");
  if (pending.length === 0) {
    fail(`nothing to cut: ${args.channel}/ holds no content yet.`);
    return 1;
  }

  if (args.dryRun) {
    say(`would move ${pending.length} entr${pending.length === 1 ? "y" : "ies"} from ${args.channel}/ to ${args.version}/, and re-create the channel.`);
    return 0;
  }

  if (args.useGit) {
    // `git mv` rather than a filesystem move, and not as a stylistic preference: it renames the index
    // entry and replays no clean filter, so the blob OIDs survive. A copy-then-add would renormalise
    // every CRLF file — 174 of them on the corpus this was built against — and turn the zero-byte
    // content diff that makes a cut cheap into a full-tree rewrite.
    execFileSync("git", ["mv", channel, target], { stdio: "inherit" });
  } else {
    renameSync(channel, target);
  }

  mkdirSync(channel, { recursive: true });
  // git does not track directories, so an emptied channel needs a file to exist in the repository at
  // all. The build manages without it, because a declared channel exists whether its folder does or not.
  writeFileSync(join(channel, ".gitkeep"), "");

  say(`cut ${pending.length} entr${pending.length === 1 ? "y" : "ies"} from ${args.channel}/ into ${args.version}/, and emptied the channel.`);
  say(`the channel now inherits everything from ${args.version}, so /${args.channel}/ serves the same pages until you write into it.`);
  return 0;
}
