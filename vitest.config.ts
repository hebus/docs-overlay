import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests resolve every workspace package to its SOURCE so that editing one does not
// require a rebuild before its consumers' tests see it. The published `exports` map is
// validated separately: `npm run typecheck:packaged` and the example app build both
// consume `dist/` with no alias at all.
//
// The rule, and it is not optional: **any workspace package imported by name from anything under test
// needs an entry here.** Without one, the import resolves through node_modules to the package's `dist/`,
// which does not exist until `npm run build` — so the suite passes on a machine that has built and fails
// in CI, where `npm test` runs first. That is exactly how `packages/cli/test` broke: it exercises the
// commands, and `check` reaches the Docusaurus adapter through `site.ts`.
//
// These mirror the `paths` in `packages/cli/tsconfig.json`, which had both from the start.
const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "docs-overlay": source("./packages/core/src/index.ts"),
      "docs-overlay-docusaurus": source("./packages/adapters/docusaurus/src/index.ts"),
      "docs-overlay-fumadocs": source("./packages/adapters/fumadocs/src/index.ts"),
      "docs-overlay-mermaid": source("./packages/adapters/mermaid/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["packages/**/src/**/*.test.ts", "packages/**/test/**/*.test.ts"]
  }
});
