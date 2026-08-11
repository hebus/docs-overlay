import type { ReactNode } from "react";
import Link from "next/link";
import { highlight } from "fumadocs-core/highlight";
import { Callout } from "fumadocs-ui/components/callout";
import { CodeBlock, CodeBlockTab, CodeBlockTabs, CodeBlockTabsList, CodeBlockTabsTrigger, Pre } from "fumadocs-ui/components/codeblock";
import { ArrowRight, Layers } from "lucide-react";

import corePkg from "docs-overlay/package.json" with { type: "json" };
import cliPkg from "docs-overlay-cli/package.json" with { type: "json" };
import docusaurusPkg from "docs-overlay-docusaurus/package.json" with { type: "json" };
import fumadocsPkg from "docs-overlay-fumadocs/package.json" with { type: "json" };

import { AdapterApi } from "@/components/landing/adapter-api";
import { CliCommands } from "@/components/landing/cli-commands";
import { CopyCommand } from "@/components/landing/copy-command";
import { DocusaurusPath } from "@/components/landing/docusaurus-path";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Footer } from "@/components/landing/footer";
import { LayerStack } from "@/components/landing/layer-stack";
import { Operations } from "@/components/landing/operations";
import { Proof } from "@/components/landing/proof";
import { ReleaseCut } from "@/components/landing/release-cut";
import { Reveal } from "@/components/landing/reveal";
import { Section } from "@/components/landing/section";

/** The three files a Fumadocs site touches, verbatim from the README so they never drift apart. */
const INTEGRATION = [
  {
    file: "source.config.ts",
    code: `import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { withOverlay } from "docs-overlay-fumadocs/schema";

export const docs = defineDocs({
  dir: "content/docs",
  docs: { schema: withOverlay(pageSchema) }
});

export default defineConfig({});`
  },
  {
    file: "lib/source.ts",
    code: `import { loader } from "fumadocs-core/source";
import { docs } from "collections/server";
import { overlaySource } from "docs-overlay-fumadocs";

export const overlay = overlaySource({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
  channels: ["next"],
  // \`/docs/...\` is the newest release, \`/docs/11.13.0/...\` an older one.
  latestAtRoot: true,
  labels: { next: "Next 🚧" }
});

export const source = loader({
  baseUrl: "/docs",
  source: overlay.source,
  url: overlay.url
});`
  },
  {
    file: "app/docs/[[...slug]]/page.tsx",
    code: `import { resolveRoute, staticParams } from "docs-overlay-fumadocs";
import { overlay, source } from "@/lib/source";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const route = resolveRoute(overlay, (await props.params).slug);

  if (route.kind === "not-found") notFound();
  if (route.kind === "redirect") return <Redirecting to={route.to} />;
  if (route.kind === "gone") return <Removed {...route} />;

  const page = source.getPage(route.slugs);
  // ...render as usual
}

export function generateStaticParams() {
  // Not \`source.generateParams()\`: that knows only pages, and it keeps the version segment even
  // where the URL drops it. \`staticParams()\` also covers aliases, old slugs and removed pages.
  return staticParams(overlay);
}`
  }
];

/**
 * Shiki runs at build time and the result ships as HTML — no highlighter reaches the browser.
 *
 * `defaultColor: false` is what the MDX pipeline uses: without it Shiki writes the light theme as
 * plain `color:` and `background-color:`, which the dark theme then cannot override.
 */
function shiki(code: string, lang: string): Promise<ReactNode> {
  return highlight(code, { lang, themes: { light: "github-light", dark: "github-dark" }, defaultColor: false, components: { pre: Pre } });
}

export default async function Home() {
  const integration = await Promise.all(INTEGRATION.map(async entry => ({ ...entry, node: await shiki(entry.code, "tsx") })));

  return (
    <>
      <section className="do-glow relative isolate overflow-hidden px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div aria-hidden="true" className="do-grid absolute inset-0 -z-10" />

        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <div>
            <Reveal>
              <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-fd-border bg-fd-card/70 px-3 py-1 font-mono text-xs text-fd-muted-foreground backdrop-blur">
                {/* Read from the packages themselves, so the four versions cannot be stale. */}
                <span className="text-fd-foreground">docs-overlay {corePkg.version}</span>
                <span aria-hidden="true">·</span>
                <span className="text-fd-foreground">fumadocs {fumadocsPkg.version}</span>
                <span aria-hidden="true">·</span>
                <span className="text-fd-foreground">docusaurus {docusaurusPkg.version}</span>
                <span aria-hidden="true">·</span>
                <span className="text-fd-foreground">cli {cliPkg.version}</span>
              </p>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
                Write the diff, <span className="bg-gradient-to-r from-do-accent to-do-accent-2 bg-clip-text text-transparent">not the docs.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-6 max-w-xl text-lg text-pretty text-fd-muted-foreground">
                Versioned documentation where each version folder holds only what actually changed — an override, a new page, a rename, or a tombstone. The
                oldest folder is the complete tree; everything after it is an overlay. Two adapters —{" "}
                <strong className="font-medium text-fd-foreground">Fumadocs</strong> and <strong className="font-medium text-fd-foreground">Docusaurus</strong>{" "}
                — on an engine that depends on neither.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 rounded-xl bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90">
                  Get started
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>

                <a
                  href="#adapters"
                  className="inline-flex items-center gap-2 rounded-xl border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground">
                  <Layers aria-hidden="true" className="size-4 text-do-accent" />
                  Fumadocs and Docusaurus
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-6 max-w-lg">
                <CopyCommand command="npm install docs-overlay docs-overlay-fumadocs" />
              </div>
            </Reveal>
          </div>

          <LayerStack />
        </div>
      </section>

      <Section
        kicker="Cutting a release"
        title="One git mv, and the release is out."
        lead="Snapshot versioning copies the whole tree every time. An overlay records only the change, so cutting a version costs nothing and duplicates nothing.">
        <ReleaseCut />
      </Section>

      <Section
        id="adapters"
        className="bg-gradient-to-b from-do-accent/6 to-transparent"
        kicker="The adapters"
        title={
          <>
            Two adapters, <span className="bg-gradient-to-r from-do-accent to-do-accent-2 bg-clip-text text-transparent">one engine</span>.
          </>
        }
        lead={
          <>
            The engine knows nothing about either framework, and the two integrations are genuinely different shapes.{" "}
            <code className="rounded bg-fd-secondary px-1.5 py-0.5 font-mono text-base">docs-overlay-fumadocs</code> re-projects the source Fumadocs already
            read, and writes nothing: three files, and the third one you already have.
          </>
        }>
        <Reveal>
          <CodeBlockTabs defaultValue={integration[0].file}>
            <CodeBlockTabsList>
              {integration.map(entry => (
                <CodeBlockTabsTrigger key={entry.file} value={entry.file}>
                  {entry.file}
                </CodeBlockTabsTrigger>
              ))}
            </CodeBlockTabsList>

            {integration.map(entry => (
              <CodeBlockTab key={entry.file} value={entry.file}>
                <CodeBlock>{entry.node}</CodeBlock>
              </CodeBlockTab>
            ))}
          </CodeBlockTabs>
        </Reveal>

        <Reveal delay={0.06}>
          <Callout type="warn" title="withOverlay() is not optional">
            <code className="font-mono">pageSchema</code> is a zod object in <code className="font-mono">strip</code> mode, so an{" "}
            <code className="font-mono">overlay:</code> key in frontmatter is dropped before it reaches your page data. Skip{" "}
            <code className="font-mono">withOverlay()</code> and everything appears to work — the site builds, pages render, search runs — except that no
            directive has any effect, with no error to explain why.
          </Callout>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="my-10 rounded-xl border border-do-accent/30 bg-fd-card px-6 py-5 text-center text-fd-muted-foreground">
            One <code className="font-mono text-fd-foreground">loader()</code> serves every version. One page tree, one search index — and a relative link such
            as <code className="font-mono text-fd-foreground">./b.md</code> resolves inside the version it was written in.
          </p>
        </Reveal>

        <AdapterApi />

        <Reveal delay={0.06}>
          <div className="mt-16">
            <h3 className="text-xl font-semibold tracking-tight">On Docusaurus, the build writes the tree instead</h3>

            <p className="mt-3 max-w-3xl text-fd-muted-foreground">
              Docusaurus reads its versions from fixed paths on disk, inside the docs plugin&rsquo;s own factory, before any hook could intervene — so there is
              no moment at which an overlay could resolve inheritance on the fly.{" "}
              <code className="rounded bg-fd-secondary px-1.5 py-0.5 font-mono text-base">docs-overlay-docusaurus</code> plans the tree it expects, and{" "}
              <code className="rounded bg-fd-secondary px-1.5 py-0.5 font-mono text-base">docs-overlay-cli</code> writes it as a prebuild step. The URLs come
              out identical, so nothing linked from outside your site moves.
            </p>

            <div className="mt-6">
              <CopyCommand command="npm install -D docs-overlay docs-overlay-cli docs-overlay-docusaurus" />
            </div>
          </div>
        </Reveal>

        <div className="mt-8">
          <DocusaurusPath />
        </div>
      </Section>

      <Section
        kicker="Authoring"
        title="Four operations, all declarative."
        lead="A version folder says what it changes. Nothing else is written down, and nothing has to be repeated.">
        <Operations />
      </Section>

      <Section
        kicker="The command line"
        title="Four commands, and none of them are a build."
        lead="cut, check and prune need only version folders, so a Fumadocs site or a plain repository of Markdown uses them exactly as a Docusaurus site does. materialize is the one that writes.">
        <CliCommands />
      </Section>

      <Section kicker="Why" title="What you get for it.">
        <FeatureGrid />
      </Section>

      <section className="border-t border-fd-border px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <Proof />
        </div>
      </section>

      <section className="border-t border-fd-border px-6 py-20 text-center lg:py-28">
        <Reveal className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Ship your next version as a diff.</h2>

          <p className="mt-4 text-fd-muted-foreground">
            Four packages, an ESM-only install, and a site that already knows how to serve every version — on Fumadocs or on Docusaurus.
          </p>

          <div className="mt-8 flex justify-center">
            <CopyCommand command="npm install docs-overlay docs-overlay-fumadocs" />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-xl bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90">
              Read the documentation
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>

            <a
              href="https://github.com/hebus/docs-overlay"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground">
              GitHub
            </a>
          </div>
        </Reveal>
      </section>

      <Footer />
    </>
  );
}
