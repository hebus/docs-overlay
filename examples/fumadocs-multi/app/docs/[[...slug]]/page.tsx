import Link from "next/link";
import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";

import { resolveRoute, staticParams } from "docs-overlay-fumadocs";

import { overlayOf, overlays, source } from "@/lib/source";

/**
 * The same catch-all a single-product site has, plus one lookup: which documentation is this?
 *
 * `resolveRoute()` is asked of that documentation only. Asking the wrong one would answer
 * `not-found` — correct, but for the wrong reason, and it would hide a genuine 404.
 */
export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await props.params;

  const overlay = overlayOf(slug);
  if (overlay === undefined) notFound();

  const route = resolveRoute(overlay, slug);
  if (route.kind === "not-found") notFound();

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
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <p data-testid="scope-banner">{`${overlay.scope} ${version?.label ?? route.version}`}</p>
        {route.inheritedFrom === undefined ? null : <p data-testid="inherited-notice">{`Unchanged since ${route.inheritedFrom.version}`}</p>}
        <MDX />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  // Every product's routes, each already carrying its own scope.
  return overlays.flatMap(overlay => staticParams(overlay));
}
