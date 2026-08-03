import { join } from "node:path";

import { createMDX } from "fumadocs-mdx/next";

// GitHub Pages serves this under /docs-overlay, injected by the deploy workflow. Empty locally.
const basePath = process.env.BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  ...(basePath === "" ? {} : { assetPrefix: basePath }),
  // The monorepo root, not this folder: npm hoists next and react up there.
  turbopack: { root: join(import.meta.dirname, "..", "..") },
  // The libraries are built with TypeScript 7, which does not expose the compiler API Next.js uses.
  experimental: { useTypeScriptCli: true }
};

export default createMDX()(config);
