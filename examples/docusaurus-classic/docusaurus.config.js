// A Docusaurus config that reads its version block instead of declaring one.
//
// CommonJS on purpose. Docusaurus loads configs through jiti, which transpiles them to CJS and
// evaluates them with `vm.Script`, so `import.meta` is a compile-time SyntaxError even inside a branch
// that never runs — and in an ESM config imported by another config, `require` is not in scope either.
// One CJS file avoids both, and `__dirname` is simply available.
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const MANIFEST = join(__dirname, ".docs-overlay", "manifest.json");

// The generated tree is not in source control, so a fresh clone has no manifest until something writes
// one. Say that plainly rather than letting Docusaurus fail later on a missing `docs.path`.
if (!existsSync(MANIFEST)) {
  throw new Error(
    "docs-overlay has not run yet, so there is no generated tree to build from.\n\n" +
      "  npm run materialize\n\n" +
      "`prebuild` and `prestart` normally do this for you.\n"
  );
}

/**
 * The `docs` plugin block, derived from the overlay rather than maintained by hand.
 *
 * This is what stops `lastVersion` and `versions` from being strings somebody has to remember to bump —
 * and what lets a site with one config file per deployment target keep both in agreement, since both
 * read the same generated file.
 */
const { payload } = JSON.parse(readFileSync(MANIFEST, "utf8"));

module.exports = {
  title: "docs-overlay on Docusaurus",
  tagline: "Two releases and a channel, authored as diffs",
  favicon: "img/favicon.svg",
  url: "https://hebus.github.io",
  // Overridable so the same materialisation serves every deployment target. Generated links carry no
  // baseUrl of their own — they resolve it with `useBaseUrl` at build time — which is what keeps
  // `materialize --check` from depending on which target ran last.
  baseUrl: process.env.BASE_URL ?? "/",
  // Every one set to throw, because that is the bar this example is here to clear: a materialised tree
  // whose links and anchors all resolve, in every version.
  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "throw" } },

  presets: [
    [
      "classic",
      {
        docs: {
          ...payload.docs,
          // Must match the `--route-base-path` the materialisation was given; `/` is the default on
          // both sides. A docs-only site, so the docs own the root.
          routeBasePath: "/"
        },
        blog: false,
        theme: { customCss: require.resolve("./src/css/custom.css") }
      }
    ]
  ],

  themeConfig: {
    navbar: {
      title: "docs-overlay",
      items: [
        // A version dropdown Docusaurus builds from the versions the overlay declared.
        { type: "docsVersionDropdown", position: "right" },
        { href: "https://github.com/hebus/docs-overlay", label: "GitHub", position: "right" }
      ]
    },
    footer: {
      style: "dark",
      copyright: "Authored as diffs with docs-overlay."
    }
  }
};
