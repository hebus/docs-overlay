import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

import { withOverlay } from "@docs-overlay/fumadocs/schema";

// `pageSchema` is a zod object in `strip` mode, so `overlay:` in frontmatter is thrown away unless
// the schema is widened. Remove `withOverlay()` and this site still builds — it just stops deleting,
// renaming and aliasing anything, with no error to explain why. `scripts/assert-output.mjs` fails in
// that case, which is the point.
export const docs = defineDocs({
  dir: "content/docs",
  docs: { schema: withOverlay(pageSchema) }
});

export default defineConfig({});
