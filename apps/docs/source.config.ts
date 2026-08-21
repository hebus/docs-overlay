import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

import { withOverlay } from "docs-overlay-fumadocs/schema";

import { remarkDiagram } from "./lib/remark-diagram";

// Without `withOverlay`, zod strips the `overlay` key from frontmatter and every directive is
// silently discarded. See the Authoring page — which this site serves through the very engine that
// key configures.
export const docs = defineDocs({
  dir: "content/docs",
  docs: { schema: withOverlay(pageSchema) }
});

export default defineConfig({
  // Appended to the fumadocs preset, never replacing it: a collection-level `mdxOptions` would drop
  // every default plugin, Shiki included. `remarkDiagram` has to run before them anyway — it needs the
  // raw fence, which Shiki has already consumed by the time a rehype plugin sees it.
  mdxOptions: { remarkPlugins: plugins => [remarkDiagram, ...plugins] }
});
