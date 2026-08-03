import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests resolve @docs-overlay/core to its SOURCE so that editing the core does not
// require a rebuild before the adapter tests see it. The published `exports` map is
// validated separately: `npm run typecheck:packaged` and the example app build both
// consume `dist/` with no alias at all.
const coreSrc = fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@docs-overlay/core": coreSrc
    }
  },
  test: {
    environment: "node",
    include: ["packages/**/src/**/*.test.ts", "packages/**/test/**/*.test.ts"]
  }
});
