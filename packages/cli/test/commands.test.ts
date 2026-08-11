/**
 * The four commands, against a real tree on a real disk.
 *
 * This package is the only one that writes anything — the engine and both adapters are I/O-free by
 * construction — so it is the only one whose contract cannot be tested with a factory-built fixture.
 * Everything asserted here is about the disk: what appears, what does not, what is left alone, and what
 * is refused.
 *
 * Written against observed behaviour rather than intent. The stub for a renamed slug is `.mdx` and the
 * channel materialises as `current/`, for example, because that is what the adapter emits — not because
 * a test decided it should.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkCommand } from "../src/commands/check.js";
import { cutCommand } from "../src/commands/cut.js";
import { materializeCommand } from "../src/commands/materialize.js";
import { pruneCommand } from "../src/commands/prune.js";
import { parseArgs } from "../src/args.js";
import { SENTINEL, walk } from "../src/io.js";

/** A page whose bytes we can compare, kept minimal so a diff is about the test and not the prose. */
const page = (title: string, body: string, directives = ""): string => `---\ntitle: ${title}\n${directives}---\n\n${body}\n`;

interface Site {
  readonly root: string;
  readonly content: string;
}

/**
 * Two releases and a channel.
 *
 * `2.0.0/guide/intro.md` is a **byte-for-byte copy** of the file it inherits, which is the situation
 * `prune` exists for: nothing breaks, nothing reports it, and the version claims to have changed a page
 * it did not. `guide/aliased.md` is copied verbatim too, but carries a directive, which is why `prune`
 * has to leave it alone.
 */
function makeSite(): Site {
  const root = mkdtempSync(join(tmpdir(), "docs-overlay-cli-"));
  const content = join(root, "content", "docs");

  const write = (path: string, text: string): void => {
    const absolute = join(content, path);
    mkdirSync(join(absolute, ".."), { recursive: true });
    writeFileSync(absolute, text);
  };

  const intro = page("Intro", "Intro.");
  const aliased = page("Aliased", "Aliased.", "overlay:\n  aliases: guide/old-name\n");

  write("1.0.0/index.md", page("Home", "Home."));
  write("1.0.0/guide/intro.md", intro);
  write("1.0.0/guide/aliased.md", aliased);
  write("1.0.0/guide/old-api.md", page("Old API", "Old."));
  // CRLF on purpose: the writer copies bytes rather than round-tripping through a string, and this is
  // the assertion that proves it.
  write("1.0.0/guide/windows.md", page("Windows", "Authored on Windows.").replace(/\n/g, "\r\n"));
  write(
    "1.0.0/sidebars.json",
    `${JSON.stringify(
      {
        docs: [
          { type: "doc", id: "index" },
          { type: "doc", id: "guide/intro" }
        ]
      },
      undefined,
      2
    )}\n`
  );

  write("2.0.0/guide/intro.md", intro); // identical to what it inherits
  write("2.0.0/guide/aliased.md", aliased); // identical, but carries a directive
  write("2.0.0/guide/changed.md", page("Changed", "Genuinely different."));
  write("2.0.0/guide/new-api.md", page("New API", "New.", "overlay:\n  renamedFrom: guide/old-api\n"));

  mkdirSync(join(content, "next"), { recursive: true });
  writeFileSync(join(content, "next", ".gitkeep"), "");

  return { root, content };
}

const materialize = async (site: Site, overrides: Partial<Parameters<typeof materializeCommand>[0]> = {}): Promise<number> =>
  materializeCommand({
    siteDir: site.root,
    contentDir: site.content,
    outDir: ".docs-overlay",
    channels: ["next"],
    routeBasePath: "/",
    labels: {},
    check: false,
    clean: true,
    json: false,
    allowErrors: false,
    ...overrides
  });

/** Everything under the site root that is not a source file, so an assertion can name the whole tree. */
const generated = (site: Site): string[] => walk(site.root).filter(path => !path.startsWith("content/"));

let site: Site;
/** Everything the command printed, so a test can assert what a human actually reads. */
let printed: string[];

const output = (): string => printed.join("\n");
const occurrences = (needle: string): number =>
  output()
    .split("\n")
    .filter(line => line.includes(needle)).length;

beforeEach(() => {
  site = makeSite();
  printed = [];
  // These commands are meant to be read by a human in a terminal; a test run is not that human.
  vi.spyOn(console, "log").mockImplementation(message => {
    printed.push(String(message));
  });
  vi.spyOn(console, "error").mockImplementation(message => {
    printed.push(String(message));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  // These trees are written under the OS temp directory; a test run that leaves one behind on every
  // invocation is a slow leak nobody notices.
  rmSync(site.root, { recursive: true, force: true });
});

describe("parseArgs", () => {
  it("refuses a flag it does not know", () => {
    // The one failure this tool cannot afford: a mistyped --dry-run that silently does the real work.
    expect(() => parseArgs(["prune", "--dry-runn"], ["--dry-run", "--json"])).toThrow(/--dry-runn/);
  });

  it("accepts the flags it declares", () => {
    const parsed = parseArgs(["cut", "2.0.0", "--dry-run"], ["--dry-run"]);
    expect(parsed.command).toBe("cut");
    expect(parsed.rest).toEqual(["2.0.0"]);
    expect(parsed.flags).toEqual({ "dry-run": true });
  });

  it("refuses a value-taking flag with no value", () => {
    expect(() => parseArgs(["prune", "--version-id"], ["--version-id="])).toThrow(/needs a value/);
  });
});

describe("materialize", () => {
  it("writes the tree Docusaurus reads", async () => {
    expect(await materialize(site)).toBe(0);

    const files = generated(site);
    expect(files).toContain("versions.json");
    expect(files).toContain("versioned_docs/version-1.0.0/index.md");
    expect(files).toContain("versioned_docs/version-2.0.0/index.md");
    expect(files).toContain("versioned_sidebars/version-1.0.0-sidebars.json");
    expect(files).toContain("versioned_sidebars/version-2.0.0-sidebars.json");
    expect(files).toContain(".docs-overlay/manifest.json");
    // The channel is the current version, which is the one `docs.path` points at.
    expect(files).toContain(".docs-overlay/current/index.md");
  });

  it("names the released versions newest first, and leaves the channel out", async () => {
    await materialize(site);
    const versions = JSON.parse(readFileSync(join(site.root, "versions.json"), "utf8")) as string[];
    expect(versions).toEqual(["2.0.0", "1.0.0"]);
  });

  it("writes an inherited page into the version that reads it", async () => {
    await materialize(site);
    // 2.0.0 has no index.md of its own; it inherits 1.0.0's, and Docusaurus needs it on disk anyway.
    expect(existsSync(join(site.content, "2.0.0", "index.md"))).toBe(false);
    expect(readFileSync(join(site.root, "versioned_docs", "version-2.0.0", "index.md"), "utf8")).toBe(page("Home", "Home."));
  });

  it("copies pages byte for byte, line endings included", async () => {
    await materialize(site);
    const source = readFileSync(join(site.content, "1.0.0", "guide", "windows.md"));
    const written = readFileSync(join(site.root, "versioned_docs", "version-1.0.0", "guide", "windows.md"));
    expect(written.equals(source)).toBe(true);
    expect(written.includes("\r\n")).toBe(true);
  });

  it("leaves a stub at the slug a rename vacated, kept out of the sidebar", async () => {
    await materialize(site);
    const stub = readFileSync(join(site.root, "versioned_docs", "version-2.0.0", "guide", "old-api.mdx"), "utf8");
    expect(stub).toContain("unlisted: true");
  });

  it("marks the directory it owns, so a later run knows it may delete inside it", async () => {
    await materialize(site);
    expect(existsSync(join(site.root, "versioned_docs", SENTINEL))).toBe(true);
  });

  it("touches nothing on a second run", async () => {
    await materialize(site);
    const before = generated(site).map(path => [path, statSync(join(site.root, path)).mtimeMs] as const);

    expect(await materialize(site)).toBe(0);

    // Not "wrote the same bytes": an identical write churns the mtime, and a churned mtime is what makes
    // a dev server rebuild in a loop. The manifest is excluded because it records its own timestamp.
    for (const [path, mtime] of before) {
      if (path.endsWith("manifest.json")) continue;
      expect(statSync(join(site.root, path)).mtimeMs, path).toBe(mtime);
    }
  });

  it("--check writes nothing and succeeds when the tree is current", async () => {
    await materialize(site);
    const before = generated(site);

    expect(await materialize(site, { check: true })).toBe(0);
    expect(generated(site)).toEqual(before);
  });

  it("--check fails, and still writes nothing, when the tree is stale", async () => {
    // Never materialised, so everything is missing — the state a contributor's CI is in when they forgot
    // to commit the generated tree.
    expect(await materialize(site, { check: true })).toBe(1);
    expect(generated(site)).toEqual([]);
  });

  it("reports each problem once", async () => {
    // A page 1.0.0's sidebar names and 2.0.0 removes. Pruning it from the inherited sidebar is a warning
    // in every version that inherits that sidebar — and each of those warnings is one problem, however
    // many places the CLI happens to collect it from.
    writeFileSync(join(site.content, "1.0.0", "guide", "legacy.md"), page("Legacy", "Here."));
    writeFileSync(join(site.content, "2.0.0", "guide", "legacy.md"), page("Legacy", "Gone.", "overlay:\n  deleted: true\n"));
    writeFileSync(
      join(site.content, "1.0.0", "sidebars.json"),
      `${JSON.stringify(
        {
          docs: [
            { type: "doc", id: "index" },
            { type: "doc", id: "guide/legacy" }
          ]
        },
        undefined,
        2
      )}\n`
    );

    await materialize(site);

    // 2.0.0 and the channel each lose the entry: two warnings, not the four the CLI used to print.
    expect(occurrences('names the doc "guide/legacy"')).toBe(2);
    expect(output()).toContain("0 error(s), 2 warning(s).");
  });

  it("refuses a target directory it did not generate", async () => {
    mkdirSync(join(site.root, "versioned_docs", "version-1.0.0"), { recursive: true });
    writeFileSync(join(site.root, "versioned_docs", "version-1.0.0", "index.md"), "committed by hand\n");

    expect(await materialize(site)).toBe(1);
    // Refused *before* a byte is written: the file it would have replaced is still the original.
    expect(readFileSync(join(site.root, "versioned_docs", "version-1.0.0", "index.md"), "utf8")).toBe("committed by hand\n");
    expect(existsSync(join(site.root, "versions.json"))).toBe(false);
  });
});

describe("cut", () => {
  const cut = (version: string, overrides: { dryRun?: boolean; channel?: string } = {}): number =>
    cutCommand({
      contentDir: site.content,
      version,
      channel: overrides.channel ?? "next",
      dryRun: overrides.dryRun ?? false,
      // No git repository in the temp directory, so the filesystem path is the one under test here.
      useGit: false
    });

  beforeEach(() => {
    writeFileSync(join(site.content, "next", "guide", "..", "pending.md"), page("Pending", "Unreleased."));
  });

  it("turns the channel into the version and brings the channel back empty", () => {
    expect(cut("3.0.0")).toBe(0);

    expect(readFileSync(join(site.content, "3.0.0", "pending.md"), "utf8")).toBe(page("Pending", "Unreleased."));
    // git does not track directories, so an emptied channel needs a file to exist in the repository.
    expect(readdirSync(join(site.content, "next"))).toEqual([".gitkeep"]);
  });

  it("--dry-run moves nothing", () => {
    expect(cut("3.0.0", { dryRun: true })).toBe(0);
    expect(existsSync(join(site.content, "3.0.0"))).toBe(false);
    expect(existsSync(join(site.content, "next", "pending.md"))).toBe(true);
  });

  it("refuses a name the engine would not read as a version", () => {
    // It would be reported as a warning at build time and the whole folder would vanish silently.
    expect(cut("release-three")).toBe(1);
    expect(existsSync(join(site.content, "release-three"))).toBe(false);
  });

  it("refuses when the target version already exists", () => {
    expect(cut("2.0.0")).toBe(1);
    expect(existsSync(join(site.content, "next", "pending.md"))).toBe(true);
  });

  it("refuses when the channel does not exist", () => {
    expect(cut("3.0.0", { channel: "canary" })).toBe(1);
  });

  it("refuses when the channel holds nothing yet", () => {
    cut("3.0.0"); // empties the channel down to .gitkeep
    expect(cut("4.0.0")).toBe(1);
    expect(existsSync(join(site.content, "4.0.0"))).toBe(false);
  });

  it("accepts a prerelease", () => {
    expect(cut("3.0.0-rc.1")).toBe(0);
    expect(existsSync(join(site.content, "3.0.0-rc.1", "pending.md"))).toBe(true);
  });
});

describe("prune", () => {
  const prune = (overrides: { dryRun?: boolean; version?: string } = {}): number =>
    pruneCommand({
      contentDir: site.content,
      channels: ["next"],
      version: overrides.version,
      dryRun: overrides.dryRun ?? false,
      useGit: false,
      json: false
    });

  it("removes only the file a version repeats byte for byte", () => {
    expect(prune()).toBe(0);

    expect(existsSync(join(site.content, "2.0.0", "guide", "intro.md"))).toBe(false);
    // Kept: its bytes match too, but pruning it would take the alias with it and the slug would stop
    // answering.
    expect(existsSync(join(site.content, "2.0.0", "guide", "aliased.md"))).toBe(true);
    expect(existsSync(join(site.content, "2.0.0", "guide", "changed.md"))).toBe(true);
    expect(existsSync(join(site.content, "2.0.0", "guide", "new-api.md"))).toBe(true);
  });

  it("leaves the oldest version alone, since it inherits nothing", () => {
    prune();
    expect(walk(join(site.content, "1.0.0"))).toEqual([
      "guide/aliased.md",
      "guide/intro.md",
      "guide/old-api.md",
      "guide/windows.md",
      "index.md",
      "sidebars.json"
    ]);
  });

  it("serves the pruned slug by inheritance afterwards", () => {
    prune();
    expect(checkCommand({ contentDir: site.content, channels: ["next"], json: false, failOn: "error" })).toBe(0);
  });

  it("--dry-run removes nothing", () => {
    expect(prune({ dryRun: true })).toBe(0);
    expect(existsSync(join(site.content, "2.0.0", "guide", "intro.md"))).toBe(true);
  });

  it("refuses a version it does not know", () => {
    expect(prune({ version: "9.9.9" })).toBe(1);
    expect(existsSync(join(site.content, "2.0.0", "guide", "intro.md"))).toBe(true);
  });
});

describe("check", () => {
  const check = (failOn: "error" | "warning"): number => checkCommand({ contentDir: site.content, channels: ["next"], json: false, failOn });

  it("passes on a tree with nothing wrong with it", () => {
    expect(check("error")).toBe(0);
    expect(check("warning")).toBe(0);
  });

  it("reports a folder that is not a version as a warning, not an error", () => {
    // Only a warning, and that is the point: the build passes and the folder's content is simply absent
    // from the site. `--fail-on warning` is what turns that into something somebody notices.
    mkdirSync(join(site.content, "draft"), { recursive: true });
    writeFileSync(join(site.content, "draft", "index.md"), page("Draft", "Draft."));

    expect(check("error")).toBe(0);
    expect(check("warning")).toBe(1);
  });

  it("reports a tombstone with nothing to remove as a warning too", () => {
    // A warning rather than an error, because the version still serves a coherent site — the tombstone
    // simply removes nothing. It is the kind of thing `--fail-on warning` is for.
    writeFileSync(join(site.content, "2.0.0", "guide", "never-existed.md"), page("Gone", "Gone.", "overlay:\n  deleted: true\n"));

    expect(check("error")).toBe(0);
    expect(check("warning")).toBe(1);
  });

  it("reports each problem once", () => {
    // Two sources describe the same problem — what `readSite` forwarded while building the overlay, and
    // what `overlay.diagnostics()` returns — and a reader who sees the same warning twice reasonably
    // concludes there are two.
    mkdirSync(join(site.content, "draft"), { recursive: true });
    writeFileSync(join(site.content, "draft", "index.md"), page("Draft", "Draft."));

    check("error");

    expect(occurrences("unknown-version-folder")).toBe(1);
    expect(output()).toContain("0 error(s), 1 warning(s).");
  });

  it("fails on two files in one version resolving to the same slug", () => {
    // An error, because one of them stops being reachable and which one is not the tool's call.
    writeFileSync(join(site.content, "2.0.0", "guide", "twice.md"), page("Twice", "One."));
    writeFileSync(join(site.content, "2.0.0", "guide", "twice.mdx"), page("Twice", "The other."));

    expect(check("error")).toBe(1);
  });
});
