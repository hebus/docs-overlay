import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const entry = (file: string) => fileURLToPath(new URL(`src/${file}`, import.meta.url));

export default defineConfig({
  build: {
    target: "es2022",
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        index: entry("index.ts"),
        // Separate entrypoint so `zod` stays an optional peer: importing the package
        // root never pulls zod in.
        schema: entry("schema.ts")
      },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`
    },
    rolldownOptions: {
      external: ["@docs-overlay/core", "zod", /^fumadocs-core($|\/)/]
    }
  }
});
