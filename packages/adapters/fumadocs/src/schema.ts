import { z } from "zod";

/**
 * Zod helpers, kept out of the package root so `zod` stays an optional peer dependency.
 *
 * ## Why this exists
 *
 * Fumadocs' `pageSchema` is a zod object in **`strip`** mode, so an `overlay:` key in frontmatter is
 * silently dropped before it ever reaches `page.data`. Nothing errors: pages render, routes work,
 * search works — and no directive has any effect. It is the worst possible failure mode, so widening
 * the schema is mandatory:
 *
 * ```ts
 * // source.config.ts
 * import { pageSchema } from "fumadocs-core/source/schema";
 * import { defineDocs } from "fumadocs-mdx/config";
 * import { withOverlay } from "docs-overlay-fumadocs/schema";
 *
 * export const docs = defineDocs({
 *   dir: "content/docs",
 *   docs: { schema: withOverlay(pageSchema) }
 * });
 * ```
 *
 * The repository this was built for already carries the same workaround for another key, in
 * `atomic/docs-site/source.config.ts`.
 */

const slugKey = z.string().min(1);

/** Shape of the `overlay` block, mirroring `OverlayDirectives` from the core. */
export const overlaySchema = z
  .object({
    /** This file is a tombstone: the page it shadows stops existing from this version onwards. */
    deleted: z.boolean().optional(),
    /** With `deleted`, removes the whole subtree rather than just the page. */
    recursive: z.boolean().optional(),
    /** Slugs this page used to live at. Each becomes a permanent redirect. */
    renamedFrom: z.union([slugKey, z.array(slugKey)]).optional(),
    /** Extra slugs serving this page, with a canonical pointing back at it. */
    aliases: z.union([slugKey, z.array(slugKey)]).optional(),
    /** Where a reader should go instead. Turns a bare 404 into a useful answer. */
    replacedBy: slugKey.optional()
  })
  .optional();

/** The `overlay` field, ready to spread into an existing zod object shape. */
export const overlayShape = { overlay: overlaySchema };

/**
 * Adds the `overlay` field to a frontmatter schema, so directives survive validation.
 *
 * Works with `pageSchema`, with `metaSchema`, and with any object schema of your own.
 */
export function withOverlay<T extends z.ZodObject>(schema: T): z.ZodObject<T["shape"] & typeof overlayShape> {
  return schema.extend(overlayShape) as unknown as z.ZodObject<T["shape"] & typeof overlayShape>;
}
