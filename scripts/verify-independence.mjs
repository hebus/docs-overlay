// Proves docs-overlay works at RUNTIME with nothing else installed.
//
// The architecture test checks the sources and the manifest; this checks the artefact. It packs the
// tarball, unpacks it into a temporary directory with no node_modules at all, and imports it there.
// If anything framework-shaped ever sneaks past the static guards, this fails with a resolution
// error instead of shipping.
//
// Run after `npm run build`.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const corePackage = join(repoRoot, "packages", "core");
const onWindows = process.platform === "win32";

function run(command, args, cwd, shell = false) {
  try {
    return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell });
  } catch (error) {
    // Without this the real failure — a resolution error inside the sandbox — is invisible.
    process.stderr.write(String(error.stderr ?? ""));
    process.stderr.write(String(error.stdout ?? ""));
    throw new Error(`${command} ${args.join(" ")} failed with status ${error.status}`);
  }
}

// npm is a .cmd shim on Windows, and Node refuses to spawn those without a shell. CI runs on Linux,
// where `shell` stays false; the Windows path is a local-development convenience.
function runNpm(args, cwd) {
  return run(onWindows ? "npm.cmd" : "npm", onWindows ? args.map(argument => `"${argument}"`) : args, cwd, onWindows);
}

const sandbox = mkdtempSync(join(tmpdir(), "docs-overlay-independence-"));

try {
  const packed = JSON.parse(runNpm(["pack", "--json", "--pack-destination", sandbox], corePackage));
  const { filename } = packed[0];

  // Relative filename with the sandbox as cwd: bsdtar on Windows reads `C:\...` as `host:path`.
  run("tar", ["-xzf", filename], sandbox);
  const unpacked = join(sandbox, "package");

  if (readdirSync(unpacked).includes("node_modules")) throw new Error("the tarball ships node_modules");

  // Exercise a real code path, not just the import, so a tree-shaken module cannot hide a problem.
  const entry = pathToFileURL(join(unpacked, "dist", "index.js")).href;
  const probe = join(sandbox, "probe.mjs");
  writeFileSync(
    probe,
    `import { createOverlay } from ${JSON.stringify(entry)};

const overlay = createOverlay({
  source: [
    { path: "1.0.0/guide/intro.md", kind: "page", meta: { title: "Intro" } },
    { path: "2.0.0/guide/added.md", kind: "page", meta: { title: "Added" } }
  ]
});

const inherited = overlay.resolve("2.0.0", "guide/intro");
if (inherited.kind !== "inherited") throw new Error(\`expected inherited, got \${inherited.kind}\`);
if (inherited.page.source.definedIn !== "1.0.0") throw new Error("wrong defining version");
if (overlay.getPages("2.0.0").length !== 2) throw new Error("wrong page count");
console.log("ok");
`
  );

  const output = run(process.execPath, [probe], sandbox).trim();
  if (output !== "ok") throw new Error(`probe printed ${JSON.stringify(output)}`);

  console.log(`docs-overlay resolves and runs with zero dependencies installed (${filename})`);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
