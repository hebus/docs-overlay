import { join } from "node:path";

import { createMDX } from "fumadocs-mdx/next";

// Static export, like the sites this library was built for. Note that Next ignores `redirects` in
// this mode — which is why old slugs come from `redirectParams()` and are rendered by the catch-all
// route instead.
/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // The monorepo root, not this folder: npm hoists `next` and `react` up there, and Turbopack
  // refuses to resolve anything outside the root it is given.
  turbopack: { root: join(import.meta.dirname, "..", "..") },
  // The repo builds its libraries with TypeScript 7 (tsgo), which does not expose the compiler API
  // Next.js uses. This makes Next shell out to the TypeScript CLI instead of pinning a second
  // TypeScript version just for this app.
  experimental: { useTypeScriptCli: true }
};

export default createMDX()(config);
