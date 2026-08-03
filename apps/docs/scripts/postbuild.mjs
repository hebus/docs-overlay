// GitHub Pages runs Jekyll unless told not to, and Jekyll drops files starting with an underscore —
// which is most of a Next.js export.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

writeFileSync(join(fileURLToPath(new URL("..", import.meta.url)), "out", ".nojekyll"), "");
console.log("postbuild: wrote out/.nojekyll");
