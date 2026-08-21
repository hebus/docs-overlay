import { execFileSync, execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
 * It also refuses to publish a package whose own files have changed since its version was set.
 * Otherwise a release cut after a few more commits had landed would ship a tree ahead of its own
 * changelog, and the tag would be the only place the discrepancy was visible. Commits that leave the
 * package untouched — a lockfile refresh, a workflow tweak, a root README — are fine, because they
 * cannot change what ships.
 *
 * `--dry-run` runs every check and prints what would happen, without prompting, publishing or tagging.
 * `--yes` skips the confirmation, for automation. The prompt exists to protect a human from an
 * accidental publish, so prefer running without it.
 */

const REGISTRY = "https://registry.npmjs.org/";
const DRY_RUN = process.argv.includes("--dry-run");
const ASSUME_YES = process.argv.includes("--yes");

/**
 * Publishable workspaces, in dependency order: the core first, then everything that depends on it.
 * `docs-overlay-mermaid` depends on neither, so its position is free — it renders Mermaid and knows
 * nothing about versioned documentation.
 */
const PACKAGES = ["packages/core", "packages/adapters/fumadocs", "packages/adapters/docusaurus", "packages/cli", "packages/adapters/mermaid"];

interface Manifest {
  readonly name: string;
  readonly version: string;
  readonly private?: boolean;
  /** What npm will pack. Checked before publishing — see {@link assertArtefacts}. */
  readonly files?: readonly string[];
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

/**
 * Refuses to publish a package that would pack without the files it declares.
 *
 * `docs-overlay-cli@0.1.0` shipped as an empty tarball: `bin`, `README`, `LICENSE` and no `dist/` at all.
 * The package was missing from the root `build` script, so nothing built it, `npm pack` packed what it
 * found, and the failure surfaced two repositories away as `ERR_MODULE_NOT_FOUND` on
 * `docs-overlay-cli/dist/cli.js` in a consumer's `node_modules`.
 *
 * This checks the artefacts rather than adding the package to one more list, because the same omission
 * has now happened three times across four lists — `build`, `typecheck`, `typecheck:packaged` and
 * `PACKAGES`. Adding a fifth list to forget would not help; failing whichever one was forgotten does.
 */
function assertArtefacts(pending: readonly Releasable[]): void {
  const problems: string[] = [];

  for (const entry of pending) {
    // No `files` means npm packs almost everything, which cannot be empty by accident.
    for (const declared of entry.files ?? []) {
      const path = join(entry.directory, declared);
      if (!existsSync(path)) {
        problems.push(`${entry.name}: declares "${declared}" in files, and it does not exist`);
        continue;
      }
      if (statSync(path).isDirectory() && readdirSync(path).length === 0) {
        problems.push(`${entry.name}: declares "${declared}" in files, and it is empty`);
      }
    }
  }

  if (problems.length === 0) return;
  throw new Error(
    `${problems.length} package(s) would publish without their declared files:\n  ${problems.join("\n  ")}\n\n` +
      `Nothing was published. This usually means the package is missing from the root \`build\` script,\n` +
      `so it was never built — check that every entry in PACKAGES is also built there.`
  );
}

/**
 * Asks the registry through a shell, because npm is a `.cmd` on Windows and `execFileSync` refuses to
 * run one — `EINVAL` ever since Node's fix for CVE-2024-27980. The arguments are constants from
 * {@link PACKAGES}, never input, so building a command line is safe here.
 */
function captureNpm(args: readonly string[]): string {
  return execSync(`npm ${args.join(" ")}`, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

function publishedVersions(name: string): string[] {
  try {
    // `npm view versions --json` yields an array, except when a single version exists, where it yields
    // a bare string.
    const parsed = JSON.parse(captureNpm(["view", name, "versions", "--json", "--registry", REGISTRY])) as string[] | string;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    // Never published is the one failure that means "nothing on npmjs yet". Reading any other one that
    // way — no network, a registry hiccup — would make the script try to republish a version that
    // exists, and npm would refuse in the middle of a release, after the first package went out.
    if (String((error as { stderr?: unknown }).stderr).includes("E404")) return [];
    throw new Error(`could not ask npmjs which versions of ${name} exist — refusing to guess.\n${String((error as { stderr?: unknown }).stderr ?? error)}`);
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

/** The commit that set a package's current version. */
function versionCommit(entry: Releasable): string | undefined {
  const history = capture("git", ["log", "--format=%H", "--", `${entry.directory}/package.json`])
    .split("\n")
    .filter(Boolean);

  // Newest first: the introducing commit is the oldest one still carrying this version.
  for (const sha of history) {
    if (versionAt(sha, entry.directory) !== entry.version) continue;
    if (versionAt(`${sha}~1`, entry.directory) !== entry.version) return sha;
  }
  return undefined;
}

/**
 * Nothing inside a package may have changed since its version was set.
 *
 * That, and not "HEAD is the version commit", is the property worth enforcing: publishing 0.1.0 from a
 * tree that already carries two unreleased features would leave npm, the changelog and git each
 * describing something different. Refreshing the lockfile after a bump, on the other hand, changes
 * nothing that ships — and demanding an untouched HEAD would have forbidden it.
 */
function assertReleaseCommit(entries: readonly Releasable[]): void {
  const problems: string[] = [];

  for (const entry of entries) {
    const sha = versionCommit(entry);
    if (sha === undefined) {
      problems.push(`${entry.name}: cannot find the commit that set ${entry.version}`);
      continue;
    }

    const changed = capture("git", ["diff", "--name-only", `${sha}..HEAD`, "--", entry.directory]);
    if (changed !== "") {
      const files = changed.split("\n").filter(Boolean);
      problems.push(`${entry.name}@${entry.version}: ${files.length} file(s) changed since ${sha.slice(0, 7)} — ${files.slice(0, 3).join(", ")}`);
    }
  }

  if (problems.length === 0) return;
  throw new Error(
    `${problems.join("; ")}. A published version must match the tree its changelog describes, so cut a ` + "new version rather than shipping this one."
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
  } else if (ASSUME_YES) {
    p.log.warn("--yes given; publishing without confirmation.");
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

  // The gate that catches a broken `exports` map or a stray framework import before anything ships —
  // and, first, a package that would pack without the files it declares.
  const verifying = p.spinner();
  verifying.start("Verifying the artefacts…");
  assertArtefacts(pending);
  run("npm run typecheck:packaged");
  run("npm run verify:independence");
  verifying.stop("Artefacts verified.");

  if (DRY_RUN) {
    p.outro("Dry run complete — nothing was published.");
    return;
  }

  for (const entry of pending) {
    run(`npm publish -w ${entry.name} --registry ${REGISTRY}`);
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
