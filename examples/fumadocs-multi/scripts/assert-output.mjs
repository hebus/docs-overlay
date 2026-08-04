// End-to-end assertions on the exported site.
//
// The unit suites work on data structures; this one reads the HTML a reader would get. It exists to
// prove the two failure modes of serving several documentations from one loader: content of one
// product leaking into the other, and a foreign scope being mistaken for a page.
//
// Runs as `postbuild`.

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

// Both products have 2.0.0 or 1.0.0 as their newest release, served without a version segment —
// `/docs/alpha/...` is alpha 2.0.0, `/docs/alpha/1.0.0/...` its older one.

// 1. Each product keeps its own scope in the URL, and its own version alongside.
check("alpha's landing page exists", exists("/docs/alpha"));
check("beta's landing page exists", exists("/docs/beta"));
check("alpha's older version is addressable", exists("/docs/alpha/1.0.0/guide/shared"));
check("beta's only version is at its root", exists("/docs/beta/guide/shared"));

// 2. The same slug in both products does NOT collide — the single loader would otherwise keep one.
check("alpha serves its own shared page", html("/docs/alpha/guide/shared").includes("alpha's rewritten shared page"));
check("beta serves its own shared page", html("/docs/beta/guide/shared").includes("beta's shared page"));
check("alpha 1.0.0 still serves the original", html("/docs/alpha/1.0.0/guide/shared").includes("alpha's shared page"));
// Discriminating on the prose, not on the word "alpha": the sidebar and the nav list both products on
// every page, so a looser check would fail while nothing is wrong.
check("beta's page is not alpha's", !html("/docs/beta/guide/shared").includes("alpha's shared page"));

// 3. Inheritance runs inside a product, and never across.
check("alpha 2.0.0 inherits only-alpha from 1.0.0", exists("/docs/alpha/guide/only-alpha"));
check("and says where it comes from", html("/docs/alpha/guide/only-alpha").includes("Unchanged since 1.0.0"));
check("beta never gains alpha's page", !exists("/docs/beta/guide/only-alpha"));

// 4. A page a product owns claims no inheritance.
check("alpha 1.0.0 owns shared, so no notice", !html("/docs/alpha/1.0.0/guide/shared").includes("Unchanged since"));

// 5. Each page knows which product it belongs to.
check("alpha pages are labelled alpha", html("/docs/alpha/guide/shared").includes("alpha 2.0.0"));
check("beta pages are labelled beta", html("/docs/beta/guide/shared").includes("beta 1.0.0"));

// 6. A scope nobody declared gets no HTML at all, rather than a page of some product's root version.
check("an unknown product is not routed", !exists("/docs/nobody/guide/shared"));
check("alpha's slug under beta is not routed", !exists("/docs/beta/guide/only-alpha"));

if (failures.length > 0) {
  console.error(`\nassert-output: ${failures.length} assertion(s) failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("assert-output: every assertion passed");
