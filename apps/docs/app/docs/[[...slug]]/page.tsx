import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import defaultMdxComponents from "fumadocs-ui/mdx";

import { resolveRoute, staticParams } from "docs-overlay-fumadocs";

import { Diagram } from "@/components/diagram";
import { DiagramStyles } from "@/components/diagram-styles";
import { withBasePath } from "@/lib/base-path";
import { canonicalUrlOf } from "@/lib/canonical";
import { InheritedNotice } from "@/lib/inherited-notice";
import { overlay, source } from "@/lib/source";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const route = resolveRoute(overlay, (await props.params).slug);

  if (route.kind === "not-found") notFound();

  // Static export ignores `next.config` redirects, so a moved page is rendered as one.
  //
  // No `<link rel="canonical">` here: `generateMetadata` marks this route `noindex`, and a canonical on a
  // page asking not to be indexed is two contradictory instructions.
  //
  // `withBasePath` on the refresh target, because that attribute is not a `<Link>` and Next leaves it
  // exactly as written — which is why this redirect used to land on a 404 on the deployed site.
  if (route.kind === "redirect") {
    return (
      <DocsPage>
        <DocsTitle>Moved</DocsTitle>
        <DocsBody>
          <meta httpEquiv="refresh" content={`0; url=${withBasePath(route.to)}`} />
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
        <MDX components={{ ...defaultMdxComponents, a: createRelativeLink(source, page), Diagram, DiagramStyles }} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  // Not `source.generateParams()`: that knows only pages, and keeps the version segment even where the
  // URL drops it.
  return staticParams(overlay);
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const slug = (await props.params).slug;
  const route = resolveRoute(overlay, slug);

  // A redirect stub and a tombstone are routes, not pages: they exist so a link that used to work still
  // says something. Indexing them puts thin pages in the results under this site's name, and they would
  // compete with the page they point at — so they are followed and not indexed.
  if (route.kind === "redirect") {
    return { title: "Moved", robots: { index: false, follow: true } };
  }
  if (route.kind === "gone") {
    return { title: `Removed in ${route.deletedIn}`, robots: { index: false, follow: true } };
  }
  if (route.kind !== "page") return { title: "docs-overlay" };

  const page = source.getPage(route.slugs);
  const canonical = canonicalUrlOf(slug);

  return {
    title: page?.data.title ?? "docs-overlay",
    description: page?.data.description,
    ...(canonical === undefined ? {} : { alternates: { canonical } })
  };
}
