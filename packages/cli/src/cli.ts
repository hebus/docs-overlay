/**
 * The one bin.
 *
 * `cut` and `check` are universal; `materialize` is Docusaurus-specific and loads its adapter lazily, so
 * a Fumadocs project installing this to move a folder never pulls Docusaurus knowledge in.
 *
 * A trap worth knowing about, because the first run is where it bites: `npx docs-overlay` resolves the
 * *package* `docs-overlay`, which is the engine and has no bin, and fails with nothing useful to say.
 * The first invocation is `npx docs-overlay-cli`; afterwards the `docs-overlay` bin works from package
 * scripts and `npm exec`.
 */

import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { boolFlag, parseArgs, stringFlag } from "./args.js";
import { checkCommand } from "./commands/check.js";
import { cutCommand } from "./commands/cut.js";
import { materializeCommand } from "./commands/materialize.js";
import { fail, say } from "./log.js";

const FLAGS = [
  "--site-dir=",
  "--content-dir=",
  "--out-dir=",
  "--channel=",
  "--route-base-path=",
  "--label=",
  "--fail-on=",
  "--check",
  "--no-clean",
  "--dry-run",
  "--no-git",
  "--json",
  "--allow-errors",
  "--help",
  "--version"
];

const USAGE = `docs-overlay — versioned documentation you author as diffs

  docs-overlay materialize [--check]     write the tree Docusaurus reads from content/docs
  docs-overlay check                     run the engine's diagnostics, no framework needed
  docs-overlay cut <version>             the channel folder becomes that version

Common options
  --site-dir <path>          site root; default: the nearest ancestor with a docusaurus.config.*
  --content-dir <path>       version folders; default: <site-dir>/content/docs
  --out-dir <path>           what the tool owns and may delete; default: .docs-overlay
  --channel <name>           repeatable; default: next
  --route-base-path <path>   must match the docs plugin's routeBasePath; default: /
  --label <id=text>          repeatable display label, e.g. --label next="Next 🚧"
  --json                     machine-readable output

materialize
  --check                    write nothing; exit 1 if the tree is out of date
  --no-clean                 keep files a previous run wrote that this one does not
  --allow-errors             finish despite content errors

check
  --fail-on error|warning    default: error

cut
  --dry-run                  print what would move
  --no-git                   plain filesystem move; history is not preserved
`;

export async function main(argv: readonly string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs(argv, FLAGS);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (boolFlag(parsed.flags, "help") || parsed.command === undefined) {
    say(USAGE);
    return parsed.command === undefined && !boolFlag(parsed.flags, "help") ? 1 : 0;
  }

  // A URL path that arrives looking like a Windows path is almost always MSYS argument conversion: Git
  // Bash rewrites anything shaped like an absolute POSIX path, so `--route-base-path /` reaches the
  // process as `C:/Program Files/Git/`. Caught here because the alternative is worse — the value only ends
  // up inside generated links, so it fails silently by poisoning every one of them rather than crashing.
  for (const name of ["route-base-path"]) {
    const value = stringFlag(parsed.flags, name);
    if (value !== undefined && /^[A-Za-z]:[/\\]|\\/.test(value)) {
      fail(
        `--${name} looks like a filesystem path: ${value}\n\n` +
          `Under Git Bash, MSYS rewrites arguments that look like absolute POSIX paths.\n\n` +
          `The reliable fix is to run this from a package.json script, where no conversion happens — which\n` +
          `is where it belongs anyway, as a prebuild step.\n\n` +
          `To run it by hand from Git Bash, exclude just this flag:\n` +
          `  MSYS2_ARG_CONV_EXCL='--${name}=' docs-overlay ... --${name}=/your/path\n\n` +
          `Excluding everything with '*' also stops --site-dir being converted, which then reaches Node as\n` +
          `an unresolvable /c/... path — so exclude per flag, or give paths in Windows form.\n`
      );
      return 1;
    }
  }

  const siteDir = resolveSiteDir(stringFlag(parsed.flags, "site-dir"));
  const contentDir = resolvePath(siteDir, stringFlag(parsed.flags, "content-dir") ?? join("content", "docs"));
  const outDir = stringFlag(parsed.flags, "out-dir") ?? ".docs-overlay";
  const channels = collect(argv, "--channel").length > 0 ? collect(argv, "--channel") : ["next"];
  const json = boolFlag(parsed.flags, "json");

  switch (parsed.command) {
    case "materialize":
      return materializeCommand({
        siteDir,
        contentDir,
        outDir,
        channels,
        routeBasePath: stringFlag(parsed.flags, "route-base-path") ?? "/",
        labels: labelsFrom(argv),
        check: boolFlag(parsed.flags, "check"),
        clean: !boolFlag(parsed.flags, "no-clean"),
        json,
        allowErrors: boolFlag(parsed.flags, "allow-errors")
      });

    case "check": {
      const failOn = stringFlag(parsed.flags, "fail-on") ?? "error";
      if (failOn !== "error" && failOn !== "warning") {
        fail("--fail-on takes error or warning.");
        return 1;
      }
      return checkCommand({ contentDir, channels, json, failOn });
    }

    case "cut": {
      const version = parsed.rest[0];
      if (version === undefined) {
        fail("cut needs a version: `docs-overlay cut 5.0.0`.");
        return 1;
      }
      return cutCommand({
        contentDir,
        version,
        channel: channels[0]!,
        dryRun: boolFlag(parsed.flags, "dry-run"),
        useGit: !boolFlag(parsed.flags, "no-git")
      });
    }

    default:
      fail(`Unknown command "${parsed.command}". Run \`docs-overlay --help\`.`);
      return 1;
  }
}

/** Walks up from the working directory looking for a Docusaurus config, so the tool works from anywhere in a site. */
function resolveSiteDir(given: string | undefined): string {
  if (given !== undefined) return resolve(given);

  let directory = process.cwd();
  for (;;) {
    if (["docusaurus.config.js", "docusaurus.config.ts", "docusaurus.config.mjs"].some(name => existsSync(join(directory, name)))) return directory;
    const parent = dirname(directory);
    if (parent === directory) return process.cwd();
    directory = parent;
  }
}

const resolvePath = (siteDir: string, path: string): string => (isAbsolute(path) ? path : join(siteDir, path));

/** Repeatable flags, read from argv directly because one value per name is the parser's whole simplification. */
function collect(argv: readonly string[], name: string): string[] {
  const out: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === name) {
      const value = argv[index + 1];
      if (value !== undefined && !value.startsWith("--")) out.push(value);
    } else if (argument.startsWith(`${name}=`)) {
      out.push(argument.slice(name.length + 1));
    }
  }
  return out;
}

function labelsFrom(argv: readonly string[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const pair of collect(argv, "--label")) {
    const index = pair.indexOf("=");
    if (index > 0) labels[pair.slice(0, index)] = pair.slice(index + 1).replace(/^["']|["']$/g, "");
  }
  return labels;
}

const invokedDirectly = process.argv[1] !== undefined && /docs-overlay(\.mjs)?$|cli\.(js|ts)$/.test(process.argv[1]);
if (invokedDirectly) {
  main(process.argv.slice(2))
    .then(code => process.exit(code))
    .catch((error: unknown) => {
      fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
      process.exit(1);
    });
}
