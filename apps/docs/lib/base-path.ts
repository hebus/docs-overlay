/**
 * The base path, and the one place that knows a raw attribute needs it.
 *
 * GitHub Pages serves this site from a subdirectory, so `next.config.mjs` sets `basePath` from the same
 * variable read here. Next then prefixes what it controls — `<Link href>`, `<Image src>`, the router — and
 * nothing it does not. A hand-written `href`, or the `url=` inside a `<meta http-equiv="refresh">`, is
 * left exactly as written and therefore points outside the deployed site.
 *
 * That is not a hypothetical: the redirect a rename leaves behind pointed at
 * `https://hebus.github.io/docs/...` instead of `https://hebus.github.io/docs-overlay/docs/...` and
 * returned a 404 on the live site — the one feature the site exists to demonstrate.
 *
 * The Docusaurus adapter avoids the same trap by resolving `useBaseUrl` at build time in its stubs.
 */
export const basePath = process.env.BASE_PATH ?? "";

/** A site-relative path an attribute can carry verbatim. Pass anything starting with `/`. */
export const withBasePath = (path: string): string => `${basePath}${path}`;
