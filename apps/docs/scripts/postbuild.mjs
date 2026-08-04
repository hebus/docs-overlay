// GitHub Pages runs Jekyll unless told not to, and Jekyll drops files starting with an underscore —
// which is most of a Next.js export.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(fileURLToPath(new URL("..", import.meta.url)), "out");

writeFileSync(join(out, ".nojekyll"), "");
console.log("postbuild: wrote out/.nojekyll");

/**
 * Fumadocs' `createRelativeLink` rewrites an href only when it starts with `./` or `../` **and**
 * resolves to a file that exists; otherwise it hands the href back untouched and says nothing. A
 * `.md` link missing its `./`, or one aimed outside the content tree, therefore ships as a 404 in
 * silence — twice, once per version serving the page.
 *
 * The export is the first place both ends of a link are knowable, so the check belongs here rather
 * than in `reportDiagnostics()`, which sees content but not routes.
 */
const IGNORED = /^(https?:|mailto:|tel:)/;

// Pages serves the site under a base path, which Next prefixes onto every emitted href while the
// export keeps its paths relative to `out/`. Strip it back off, or every link looks dead — but only
// in the deploy build, which is exactly where nobody would see the check fail first.
const basePath = process.env.BASE_PATH ?? "";

// A link reaches the export as rendered markup, as an escaped RSC payload, or — for a body link
// rendered through a client component — as the payload alone. Missing the second form would miss
// most of the prose links.
const HREF_PATTERNS = [/href="([^"]+)"/g, /\\"href\\":\\"([^"\\]+)\\"/g];

function htmlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...htmlFiles(path));
    else if (entry.name.endsWith(".html")) found.push(path);
  }
  return found;
}

/** The file a pathname is served from: a route directory, a bare `.html`, or a static asset. */
function served(pathname) {
  const clean = pathname.replace(/\/$/, "");
  const candidates = [join(out, clean, "index.html"), join(out, `${clean}.html`), join(out, clean)];
  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile());
}

const pages = new Map(htmlFiles(out).map(file => [file, readFileSync(file, "utf8")]));

/** Headings are server-rendered, so a missing `id` in the export is a missing anchor for real. */
function anchored(file, fragment) {
  const html = pages.get(file) ?? readFileSync(file, "utf8");
  return html.includes(`id="${fragment}"`);
}

function fault(href, from) {
  if (IGNORED.test(href)) return undefined;

  const [raw, fragment] = href.split("#");

  if (raw === "") {
    if (!fragment) return undefined; // `#` alone is a control, not a destination.
    return anchored(from, fragment) ? undefined : "no such anchor on this page";
  }

  if (!raw.startsWith("/")) {
    return "left unresolved — a relative link needs a `./` prefix and a target that exists";
  }

  // Rendered markup carries the base path, since `next/link` prefixes it; the RSC payload carries
  // the same link as an unprefixed internal URL. Accept either, so a deploy build does not report
  // every prose link as dead.
  const prefixed = basePath !== "" && (raw === basePath || raw.startsWith(`${basePath}/`));
  const pathname = prefixed ? raw.slice(basePath.length) : raw;

  // Build assets are emitted by Next, not authored, and there are thousands of them.
  if (pathname.startsWith("/_next/")) return undefined;

  const target = served(pathname);
  if (target === undefined) return "no such route in the export";
  if (fragment && target.endsWith(".html") && !anchored(target, fragment)) {
    return "route exists, anchor does not";
  }

  return undefined;
}

const dead = [];
for (const [file, html] of pages) {
  const seen = new Set();
  for (const pattern of HREF_PATTERNS) {
    for (const [, href] of html.matchAll(pattern)) {
      if (seen.has(href)) continue;
      seen.add(href);

      const problem = fault(href, file);
      if (problem !== undefined) dead.push(`${relative(out, file)} → ${href} (${problem})`);
    }
  }
}

if (dead.length > 0) {
  for (const link of dead) console.log(`postbuild: dead link — ${link}`);
  throw new Error(`${dead.length} dead link(s); see the log above.`);
}

console.log(`postbuild: checked links across ${pages.size} exported pages, none dead`);
