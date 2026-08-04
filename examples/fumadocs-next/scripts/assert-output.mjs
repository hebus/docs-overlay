// End-to-end assertions on the exported site.
//
// This is the test that proves the product: the unit suites work on data structures, this one reads
// the HTML a reader would actually get. Runs as `postbuild`.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(fileURLToPath(new URL("..", import.meta.url)), "out");

const failures = [];
const check = (label, condition) => {
  if (condition !== true) failures.push(label);
};

const pagePath = url => join(out, ...url.split("/").filter(Boolean), "index.html");
const exists = url => existsSync(pagePath(url));
const html = url => (exists(url) ? readFileSync(pagePath(url), "utf8") : "");

// The newest release is 4.0.0 and sits at /docs, so an explicit segment means an older version.

// 1. Inheritance across several hops: 2.0.0 rewrote the intro, and 3.0.0 shows that rewrite.
check("3.0.0/guide/intro exists", exists("/docs/3.0.0/guide/intro"));
check("3.0.0/guide/intro shows the 2.0.0 rewrite", html("/docs/3.0.0/guide/intro").includes("This is the 2.0.0 text"));
check("1.0.0/guide/intro still shows the 1.0.0 text", html("/docs/1.0.0/guide/intro").includes("This is the 1.0.0 text"));

// 2. A page never overridden is served by every version from one source file.
check("4.0.0 inherits guide/setup from 1.0.0", html("/docs/guide/setup").includes("content/docs/1.0.0/guide/setup.md"));
// …and the resolver says so in prose, not just through a file path.
check("4.0.0/guide/setup tells the reader where it comes from", html("/docs/guide/setup").includes("Unchanged since 1.0.0"));
// The negative matters more: a notice shown unconditionally would satisfy the assertion above.
check("1.0.0/guide/setup claims no inheritance, since it owns the file", !html("/docs/1.0.0/guide/setup").includes("Unchanged since"));

// 3. Tombstone: present in 2.0.0, removed in 3.0.0, back in 4.0.0.
check("2.0.0/guide/stays exists", exists("/docs/2.0.0/guide/stays"));
check("3.0.0/guide/stays explains the removal", html("/docs/3.0.0/guide/stays").includes("Removed in 3.0.0"));
check("3.0.0/guide/stays points at its replacement", html("/docs/3.0.0/guide/stays").includes("/docs/3.0.0/guide/modern"));
check("4.0.0/guide/stays is back", html("/docs/guide/stays").includes("back here"));

// 4. Rename: a redirect from the renaming version onwards, a real page before it.
check("2.0.0/guide/old-api redirects", html("/docs/2.0.0/guide/old-api").includes('rel="canonical" href="/docs/2.0.0/guide/new-api"'));
check("1.0.0/guide/old-api serves the old content, not a redirect", html("/docs/1.0.0/guide/old-api").includes("plain 200"));
check("1.0.0/guide/old-api is not a redirect", !html("/docs/1.0.0/guide/old-api").includes('http-equiv="refresh"'));
check("the redirect survives into the newest release", exists("/docs/guide/old-api"));

// 5. Navigation inheritance: a page added under an inherited exhaustive `pages` list stays visible.
check("3.0.0/guide/added exists", exists("/docs/3.0.0/guide/added"));
check("3.0.0/guide/added is in its own sidebar", html("/docs/3.0.0/guide/added").includes("/docs/3.0.0/guide/setup"));

// 6. Alias: a second slug for the same page, with a canonical pointing at the real one.
check("the alias is served", exists("/docs/1.0.0/api-reference"));
check("the alias declares a canonical", html("/docs/1.0.0/api-reference").includes('rel="canonical" href="/docs/1.0.0/api"'));

if (failures.length > 0) {
  console.error(`\nassert-output: ${failures.length} assertion(s) failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("assert-output: every assertion passed");
