import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const entry = (file: string) => fileURLToPath(new URL(`src/${file}`, import.meta.url));

export default defineConfig({
  build: {
    target: "es2022",
    minify: false,
    sourcemap: true,
    ssr: true,
    lib: {
      entry: { index: entry("index.ts"), cli: entry("cli.ts") },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`
    },
    rolldownOptions: {
      // The Docusaurus adapter is an optional peer, imported lazily: a Fumadocs project should not have
      // to install Docusaurus knowledge in order to cut a release.
      external: ["docs-overlay", "docs-overlay-docusaurus", "yaml", /^@clack\//, /^node:/]
    }
  }
});
