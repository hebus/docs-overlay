// Cuts a documentation release: `next/` becomes the version that was just bumped.
//
// Runs from `changeset:version`, so it lands in the "chore: version packages" commit and is reviewed
// in that pull request alongside the bump it belongs to. `changesets/action` commits with `git add .`
// from the repository root, so a rename made here is carried without any extra commit.
//
// Not in `scripts/release.ts`: that one refuses a dirty tree, and by the time it runs the version
// pull request has already been merged — which republishes the site, once, without the cut.
//
// The site documents the engine, so its folders follow `docs-overlay`'s version. A release of the
// adapter alone therefore cuts nothing, and says so.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const content = join(root, "apps", "docs", "content", "docs");
const channel = join(content, "next");

const say = message => console.log(`cut-docs: ${message}`);

/**
 * Kept in step with `packages/core/src/version/semver.ts:11` by hand, because this script runs before
 * anything is built — there is no `dist/` to import from at `changeset version` time.
 *
 * The check is worth its duplication: a folder the engine cannot parse is reported as
 * `unknown-version-folder` with severity **warning**, so the build would pass and the whole cut
 * folder would vanish from the site without a word. Refusing to cut is the lesser failure.
 */
const VERSION = /^v?\d+(?:\.\d+)?(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const version = JSON.parse(readFileSync(join(root, "packages", "core", "package.json"), "utf8")).version;

if (!VERSION.test(version)) {
  say(`refusing to cut: "${version}" is not a name the engine would read as a version.`);
  process.exit(0);
}

if (!existsSync(channel)) {
  say("nothing to cut: there is no next/ channel.");
  process.exit(0);
}

const target = join(content, version);
if (existsSync(target)) {
  // Either this release is already cut, or the engine's version did not change — the adapter can ship
  // on its own. Both are ordinary, and this script runs again on every push to main.
  say(`nothing to do: ${version}/ already exists.`);
  process.exit(0);
}

const pending = readdirSync(channel).filter(name => name !== ".gitkeep");
if (pending.length === 0) {
  say("nothing to cut: next/ holds no content yet.");
  process.exit(0);
}

// `git mv` rather than a filesystem move, so git records renames and the content diff stays empty.
execFileSync("git", ["mv", join("apps", "docs", "content", "docs", "next"), join("apps", "docs", "content", "docs", version)], {
  cwd: root,
  stdio: "inherit"
});

// git does not track directories, so the emptied channel needs a file to exist in the repository at
// all. The build would manage without it — `channels` makes the version exist regardless.
mkdirSync(channel);
writeFileSync(join(channel, ".gitkeep"), "");

say(`cut ${pending.length} file(s) from next/ into ${version}/, and emptied the channel.`);
