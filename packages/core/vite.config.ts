import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// https://vite.dev/guide/build.html#library-mode
// ESM only: every consumer of this package (fumadocs-core, source.config.ts, adapters)
// is ESM. Shipping CJS as well would only buy the dual-package hazard.
export default defineConfig({
  build: {
    target: "es2022",
    minify: false,
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL("src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "index.js"
    }
  }
});
