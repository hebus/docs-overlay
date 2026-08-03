import { execFileSync, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";

/**
 * Publishes a stable release to npmjs. Changesets has already bumped the versions — this script never
 * bumps anything.
 *
 * Modelled on the same flow used for `@sinequa/atomic`, with two differences that matter here: this is
 * a monorepo, so each package carries its own version and gets its own tag, and there is only one
 * registry.
 *
 * Idempotent throughout: a version already on npmjs is skipped, and an existing tag is left alone. A
 * half-finished release can simply be run again.
 *
 * It also refuses to publish from anywhere but the commit that introduced the version. Otherwise a
 * release cut after a few more commits had landed would ship a tree ahead of its own changelog, and
 * the tag would be the only place the discrepancy was visible.
 *
 * `--dry-run` runs every check and prints what would happen, without prompting, publishing or tagging.
 */

const REGISTRY = "https://registry.npmjs.org/";
const DRY_RUN = process.argv.includes("--dry-run");

/** Publishable workspaces, in dependency order: the adapter depends on the core. */
const PACKAGES = ["packages/core", "packages/adapters/fumadocs"];

interface Manifest {
  readonly name: string;
  readonly version: string;
  readonly private?: boolean;
}

type Releasable = Manifest & { readonly directory: string };

function run(command: string): void {
  execSync(command, { stdio: "inherit", cwd: process.cwd() });
}

function capture(command: string, args: readonly string[]): string {
  return execFileSync(command, [...args], { cwd: process.cwd() })
    .toString()
    .trim();
}

function manifest(directory: string): Manifest {
  return JSON.parse(readFileSync(join(directory, "package.json"), "utf-8")) as Manifest;
}

function publishedVersions(name: string): string[] {
  try {
    // `npm view versions --json` yields an array, except when a single version exists, where it yields
    // a bare string.
    const parsed = JSON.parse(capture("npm", ["view", name, "versions", "--json", "--registry", REGISTRY])) as string[] | string;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return []; // never published
  }
}

function tagExists(tag: string): boolean {
  try {
    capture("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]);
    return true;
  } catch {
    return false;
  }
}

/** Version recorded for a package at a given revision, or `undefined` if it was not there. */
function versionAt(ref: string, directory: string): string | undefined {
  try {
    return (JSON.parse(capture("git", ["show", `${ref}:${directory}/package.json`])) as Manifest).version;
  } catch {
    return undefined;
  }
}

/**
 * Every version about to be published must have been introduced by `HEAD` — in practice, the merged
 * "chore: version packages" commit.
 *
 * Without this, `npm run release` would happily publish 0.1.0 from a tree that already carried two
 * unreleased features: npm, the changelog and git would each describe something different.
 */
function assertReleaseCommit(entries: readonly Releasable[]): void {
  const unchanged = entries.filter(entry => versionAt("HEAD~1", entry.directory) === entry.version);
  if (unchanged.length === 0) return;

  const names = unchanged.map(entry => `${entry.name}@${entry.version}`).join(", ");
  throw new Error(
    `HEAD did not introduce ${names}. Release from the commit that bumped the version, so the tarball, ` +
      "the changelog and the tag agree. If code has landed since, cut a new version instead."
  );
}

function assertCleanTree(): void {
  const status = capture("git", ["status", "--porcelain"]);
  if (status !== "") {
    throw new Error("Working tree is not clean. Commit or stash first — a release must be reproducible from a commit.");
  }
}

async function main(): Promise<void> {
  p.intro(DRY_RUN ? "docs-overlay — release (dry run)" : "docs-overlay — release");

  assertCleanTree();

  const releasable: Releasable[] = PACKAGES.map(directory => ({ directory, ...manifest(directory) })).filter(entry => entry.private !== true);
  const pending = releasable.filter(entry => !publishedVersions(entry.name).includes(entry.version));

  for (const entry of releasable) {
    const already = pending.includes(entry) ? "" : " (already on npmjs)";
    p.log.info(`${entry.name}@${entry.version}${already}`);
  }

  if (pending.length === 0) {
    p.outro("Nothing to publish.");
    return;
  }

  // Checked after the listing above, so the log shows what was intended before the refusal.
  assertReleaseCommit(pending);

  if (DRY_RUN) {
    for (const entry of pending) {
      p.log.step(`would publish ${entry.name}@${entry.version} to npmjs`);
      p.log.step(`would tag ${entry.name}@${entry.version}${tagExists(`${entry.name}@${entry.version}`) ? " (tag already exists — would skip)" : ""}`);
    }
  } else {
    const confirmed = await p.confirm({
      message: `Build and publish ${pending.length === 1 ? "this package" : `these ${pending.length} packages`} to npmjs?`,
      initialValue: false
    });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
  }

  const building = p.spinner();
  building.start("Building…");
  run("npm run build");
  building.stop("Build complete.");

  // The gate that catches a broken `exports` map or a stray framework import before anything ships.
  const verifying = p.spinner();
  verifying.start("Verifying the artefacts…");
  run("npm run typecheck:packaged");
  run("npm run verify:independence");
  verifying.stop("Artefacts verified.");

  if (DRY_RUN) {
    p.outro("Dry run complete — nothing was published.");
    return;
  }

  for (const entry of pending) {
    run(`npm publish -w ${entry.name} --registry ${REGISTRY} --access public`);
    p.log.success(`${entry.name}@${entry.version} published`);
  }

  // One tag per package, matching what `changeset tag` produces, because the two versions drift apart.
  const head = capture("git", ["rev-parse", "HEAD"]);
  for (const entry of pending) {
    const tag = `${entry.name}@${entry.version}`;
    if (tagExists(tag)) {
      p.log.warn(`Tag ${tag} already exists — skipped.`);
      continue;
    }
    run(`git tag "${tag}" ${head}`);
    run(`git push origin "${tag}"`);
    p.log.success(`Tag ${tag} pushed`);
  }

  p.outro("Release complete.");
}

main().catch((error: unknown) => {
  p.cancel(String(error));
  process.exit(1);
});
