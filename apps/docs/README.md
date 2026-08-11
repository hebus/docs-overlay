# docs-overlay-site

The documentation site for `docs-overlay`, versioned with `docs-overlay`. It is the project's own
dogfooding, so the rules below are the product's rules rather than this app's conventions.

```bash
npm run build          # from the repository root: the four packages first
npm run build:docs     # this site
```

`npm --prefix apps/docs run dev` for the dev server.

## New pages go in `next/`

```text
apps/docs/content/docs/
  0.1.0/     the complete tree
  0.2.0/     only the pages a release rewrote
  next/      only what an unreleased change touched — often nothing
```

Write in `next/`, never in a released folder. A released folder is finished: that is the property the
whole project is about, and editing one here would contradict the documentation it serves. The one
exception is an **erratum** — a statement that is simply false — where correcting the released file is
what makes the fix visible at the URL people actually read, and `next/` inherits it for free.

`latestAtRoot: true`, so the newest release is served at `/docs/…`, older ones at `/docs/0.1.0/…`, and
the channel at `/docs/next/…` under the label "Unreleased". A page you add to `next/` is therefore live
and crawlable immediately, but it does not appear at the root until the next release.

## The cut is automatic

`scripts/cut-docs.mjs` runs inside `changeset:version`, so the "chore: version packages" pull request
renames `next/` to the engine's new version and empties the channel. Nothing to do by hand, and the
result is reviewed alongside the bump.

The folder takes **`docs-overlay`'s** version, because the site documents the engine. A release of an
adapter alone therefore cuts nothing, and the unreleased pages stay in `next/` until the engine ships.

## Three things fail the build

Each of these is deliberate — a docs site that ships a quiet mistake is worse than one that refuses to
build:

- **`reportDiagnostics()`** (called from `app/docs/layout.tsx`) throws on any content error from the
  engine, and includes `findOrphanPages()`. A page that is routed but that no sidebar reaches is an
  error, which is why every `meta.json` needs its trailing `"..."`.
- **`scripts/postbuild.mjs`** checks every internal link and anchor across the exported pages, in the
  rendered HTML and in the RSC payload. A link to a page that will only exist after the next cut is a
  broken build today.
- A `meta.json` is **inherited whole, never merged field by field**. The one in `next/` replaces the
  released version's entirely, so it has to name every page it wants, in the order it wants them.

## Editorial surfaces that are not markdown

- `app/(home)/page.tsx` and `components/landing/` — the landing page, in TSX.
- `app/layout.tsx` — title, description, keywords and social metadata.
- `lib/version-select.tsx` — the version switcher, injected as the sidebar banner.
- `lib/inherited-notice.tsx` — the "Unchanged since X" banner on inherited pages.

## Deployment

`.github/workflows/deploy-docs.yml` builds with `BASE_PATH=/docs-overlay` and publishes
`apps/docs/out` to GitHub Pages on every push to `main` that touches `apps/docs/**` or `packages/**`.
Run `BASE_PATH=/docs-overlay npm run build:docs` before merging anything that touches links: the
base-path branch of the link checker only executes in that configuration.
