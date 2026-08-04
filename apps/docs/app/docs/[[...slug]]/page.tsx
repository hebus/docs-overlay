import Link from "next/link";
import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import defaultMdxComponents from "fumadocs-ui/mdx";

import { resolveRoute, staticParams } from "docs-overlay-fumadocs";

import { InheritedNotice } from "@/lib/inherited-notice";
import { overlay, source } from "@/lib/source";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const route = resolveRoute(overlay, (await props.params).slug);

  if (route.kind === "not-found") notFound();

  // Static export ignores `next.config` redirects, so a moved page is rendered as one.
  if (route.kind === "redirect") {
    return (
      <DocsPage>
        <DocsTitle>Moved</DocsTitle>
        <DocsBody>
          <meta httpEquiv="refresh" content={`0; url=${route.to}`} />
          <link rel="canonical" href={route.to} />
          <p>
            This page moved to <Link href={route.to}>{route.to}</Link>.
          </p>
        </DocsBody>
      </DocsPage>
    );
  }

  if (route.kind === "gone") {
    return (
      <DocsPage>
        <DocsTitle>Removed in {route.deletedIn}</DocsTitle>
        <DocsBody>
          <p>This page was removed in {route.deletedIn}.</p>
          {route.replacedByUrl === undefined ? null : (
            <p>
              See <Link href={route.replacedByUrl}>{route.replacedByUrl}</Link> instead.
            </p>
          )}
          {route.lastAvailableUrl === undefined ? null : (
            <p>
              Last available at <Link href={route.lastAvailableUrl}>{route.lastAvailableUrl}</Link>.
            </p>
          )}
        </DocsBody>
      </DocsPage>
    );
  }

  const page = source.getPage(route.slugs);
  if (page === undefined) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      {route.canonicalUrl === undefined ? null : <link rel="canonical" href={route.canonicalUrl} />}
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        {overlay.inheritedNotice && route.inheritedFrom !== undefined ? <InheritedNotice from={route.inheritedFrom} /> : null}
        <MDX components={{ ...defaultMdxComponents, a: createRelativeLink(source, page) }} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  // Not `source.generateParams()`: that knows only pages, and keeps the version segment even where the
  // URL drops it.
  return staticParams(overlay);
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const route = resolveRoute(overlay, (await props.params).slug);
  if (route.kind !== "page") return { title: "docs-overlay" };

  const page = source.getPage(route.slugs);
  return { title: page?.data.title ?? "docs-overlay", description: page?.data.description };
}
