import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

import { withOverlay } from "docs-overlay-fumadocs/schema";

// Without `withOverlay`, zod strips the `overlay` key from frontmatter and every directive is
// silently discarded. See the Authoring page — which this site serves through the very engine that
// key configures.
export const docs = defineDocs({
  dir: "content/docs",
  docs: { schema: withOverlay(pageSchema) }
});

export default defineConfig({});
