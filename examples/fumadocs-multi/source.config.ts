import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

import { withOverlay } from "docs-overlay-fumadocs/schema";

/**
 * **One** collection for every documentation, which is how a real multi-product site is already laid
 * out: `content/docs/<product>/<version>/…`. Each `overlaySource()` then takes the product it serves
 * as its `scope` and ignores the rest.
 */
export const docs = defineDocs({
  dir: "content/docs",
  docs: { schema: withOverlay(pageSchema) }
});

export default defineConfig({});
