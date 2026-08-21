import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// ESM only, like every package here. `@mermaid-js/parser` stays external and is reached through a
// dynamic import at the one place that needs it, so a consumer who only renders flowcharts never
// pulls the Langium runtime into their bundle.
export default defineConfig({
  build: {
    target: "es2022",
    minify: false,
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL("src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "index.js"
    },
    rolldownOptions: {
      external: ["@dagrejs/dagre", "@mermaid-js/parser"]
    }
  }
});
