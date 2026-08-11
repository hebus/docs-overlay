---
title: Versioning documentation in a monorepo
description: Several packages, several release schedules, one documentation site — where the content lives, who cuts the versions, and what CI has to filter.
---

A monorepo publishing several packages has a problem one repository does not: `2.0.0` of `ui` has
nothing to do with `2.0.0` of `react`, so a single version list is wrong for all but one of them.

[Several documentations](./multiple-products.md) is the mechanism that solves it — a scope per product,
each with its own version folders and its own `latest`. This page is the part around it: where the
content lives, who cuts a version, and what has to change in CI.

## One site, or one site per package

Both work. The question is whether your packages are read together.

|                | One site, one scope per package                                      | One site per package                |
| -------------- | -------------------------------------------------------------------- | ----------------------------------- |
| URLs           | `/docs/ui/2.0.0/…`                                                   | `ui.example.com/docs/2.0.0/…`       |
| Search         | one index, tagged by product **and** version                         | one index each, naturally separate  |
| Relative links | resolve inside a product, never across                               | inside that site only               |
| Deployments    | one build, one deploy                                                | one per package, each independently |
| Autonomy       | one repository decides the theme and the release cadence of the site | each team owns its own              |

Choose one site when a reader crosses between packages — a design system and its React bindings, an SDK
and its CLI. Choose one per package when they are separate products that happen to share a repository,
because then a single build couples release cadences that have no reason to be coupled.

Everything below applies either way. Only the `scope` option does not.

## Where the content lives

Two arrangements are possible, and one of them is a trap.

```text
✔  docs/content/docs/<product>/<version>/…      one collection, at the site
✘  packages/ui/docs/<version>/…                 one collection per package
```

Co-locating documentation with each package reads well and breaks the two things that make a
documentation site worth having. A page tree and a search index belong to a **loader**, and a relative
link such as `./b.md` is resolved against the file system that loader owns — so splitting the content
across packages means splitting the loader, and a link from one package's page to another's stops
resolving. Keep one collection at the site and let the product be a folder inside it.

If the documentation genuinely has to live next to its package — because that is where its authors
are — mirror it into the site's content directory as a build step, and read the last section of this
page first.

## Independent version lists

One `overlaySource()` per product, all feeding **one** `loader()`. That is the whole configuration, and
it is written out in [Several documentations](./multiple-products.md#configuration). A working site is
[`examples/fumadocs-multi`](https://github.com/hebus/docs-overlay/tree/main/examples/fumadocs-multi),
where `alpha` is at `2.0.0` while `beta` is still at `1.0.0` — which is the point of the example.

## Cutting versions from the release process

A version folder should be created by whatever already knows a release happened, not by someone
remembering afterwards. With Changesets, that is the version pull request:

```json
{
  "scripts": {
    "changeset:version": "changeset version && npm install --package-lock-only && node scripts/cut-docs.mjs"
  }
}
```

This repository does exactly that, so the behaviour below is inspectable rather than advisory:

- **the cut is committed in the same pull request as the bump**, and reviewed with it;
- **it is idempotent**, because that pull request is rebuilt on every push to the base branch;
- **it refuses a name the engine would not read as a version**, rather than creating a folder that would
  vanish from the site with only a warning.

`docs-overlay cut <version>` is the same operation from the command line, with `--dry-run` — see
[The command line](./cli.md#cut-version).

## Which package's version the folder takes

The question every monorepo hits, and it has no universal answer — only a decision you should make once
and write down.

- **A site documenting one library** takes that library's version. This site takes the engine's, which
  is why a release of an adapter alone cuts nothing: the unreleased pages stay in the channel until the
  engine ships.
- **A site documenting several products** takes each product's own version, in that product's scope.
  Nothing is shared, so nothing has to agree.
- **A site documenting the repository** — a platform whose packages are released together — takes the
  repository's release tag. If your packages are versioned independently, this is the arrangement that
  will hurt: a folder named after a tag no package carries answers nobody's question.

## Only rebuild what can have changed

A monorepo's CI runs on every change, and a documentation build is not free. Filter on the paths that
can affect it:

```yaml
on:
  push:
    branches: [main]
    paths:
      - "docs/**"
      - "packages/*/src/**"
```

Include the package sources only if the site reads from them — a generated API reference does, a
hand-written guide does not. Over-filtering is worse than under-filtering here: a site that silently
stopped rebuilding looks exactly like a site with nothing new in it.

Content diagnostics are cheap enough to run unfiltered:

```bash
docs-overlay check --fail-on warning
```

Seconds, no framework build, and it catches the mistakes that are otherwise invisible until someone
follows a dead link.

## When the documentation is mirrored in from elsewhere

Any script that copies documentation into a version folder wholesale — a mirror out of a library
repository, a backport onto a maintenance branch — writes an override for **every** file it touches,
including the ones identical to what they inherit. Nothing breaks, so nothing reports it, and the
repository quietly re-inflates until the overlay stops meaning anything.

```bash
docs-overlay prune
```

Run it after the copy, as part of the same job. It removes only files whose bytes already resolve through
inheritance, keeps any file carrying an `overlay:` directive, and leaves the resolved site identical.

## Read next

- [Several documentations](./multiple-products.md) — the scope mechanism, in full.
- [Versioning documentation for an npm package](./versioning-npm-package-docs.md) — the single-package
  case, and what to do about prereleases.
- [Authoring](./authoring.md#maintenance-branches) — `inheritsFrom`, for a hotfix that must not inherit
  from the next major.
