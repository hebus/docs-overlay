import { notFound } from "next/navigation";
import Link from "next/link";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";

import { resolveRoute, staticParams } from "docs-overlay-fumadocs";

import { overlay, source } from "@/lib/source";

/**
 * The same catch-all route an unversioned Fumadocs site has, plus one call to `resolveRoute()`.
 *
 * Nothing here knows how inheritance works: it asks what to do with the incoming slugs and does it.
 */
export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await props.params;
  const route = resolveRoute(overlay, slug);

  if (route.kind === "not-found") notFound();

  // `output: "export"` ignores `next.config` redirects, so the redirect is rendered as a real page.
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
              It was replaced by <Link href={route.replacedByUrl}>{route.replacedByUrl}</Link>.
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
  const version = overlay.versionOf(route.version);

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      {route.canonicalUrl === undefined ? null : <link rel="canonical" href={route.canonicalUrl} />}
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <p data-testid="version-banner">
          Version <strong>{version?.label ?? route.version}</strong>
          {page.absolutePath === undefined ? null : (
            <>
              {" "}
              — source: <code>{page.absolutePath}</code>
            </>
          )}
        </p>
        {/* The same fact `absolutePath` shows as a file path, but as the resolver reports it. */}
        {overlay.inheritedNotice && route.inheritedFrom !== undefined ? (
          // One template string: React would otherwise split the sentence with an HTML comment, and
          // `assert-output.mjs` reads this page as text.
          <p data-testid="inherited-notice">
            {`Unchanged since ${overlay.versionOf(route.inheritedFrom.version)?.label ?? route.inheritedFrom.version} (${route.inheritedFrom.hops} hop${route.inheritedFrom.hops === 1 ? "" : "s"})`}
          </p>
        ) : null}
        <MDX />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  // Not `source.generateParams()`: that only knows pages, and it keeps the version segment even where
  // the URL drops it. `staticParams()` covers aliases, old slugs and removed pages too, in the shape
  // the URLs actually take.
  return staticParams(overlay);
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await props.params;
  const route = resolveRoute(overlay, slug);
  if (route.kind !== "page") return { title: "docs-overlay" };

  const page = source.getPage(route.slugs);
  return { title: page?.data.title ?? "docs-overlay", description: page?.data.description };
}
