import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const entry = (file: string) => fileURLToPath(new URL(`src/${file}`, import.meta.url));

export default defineConfig({
  build: {
    target: "es2022",
    minify: false,
    sourcemap: true,
    lib: {
      entry: { index: entry("index.ts") },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`
    },
    rolldownOptions: {
      // The adapter performs no I/O and imports nothing from Docusaurus, so the core is the only
      // thing to keep external. There is no `@docusaurus/*` peer to declare either: the sidebar
      // shape is described structurally here, because a type-only peer a consumer must install in
      // order to typecheck is a cost with nothing bought.
      external: ["docs-overlay"]
    }
  }
});
