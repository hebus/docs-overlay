---
title: Resolution
description: How the overlay chain is folded, and what resolve() answers.
---

## Fold forward, do not walk at query time

The chain is **not** walked on every lookup. Each version's index is materialised once by overlaying
its own folder on top of its parent's **already-folded index** — not on the parent's folder.

```
1.0.0 folder ──▶ index[1.0.0]
                      │  copy, own → inherited, hops+1
                      ▼
2.0.0 folder ──▶ index[2.0.0]
                      │
                      ▼
3.0.0 folder ──▶ index[3.0.0]
```

`resolve()` is then a single `Map` read, and three properties fall out for free:

- **Multi-hop.** A page written in `1.0.0` and never touched appears in `6.0.0` with `hops: 5` and the
  right defining version, with no recursion.
- **Delete then re-add.** An own file simply overwrites the inherited tombstone. No special case.
- **Branching chains.** `11.13.1` and `11.14.0` can both inherit from `11.13.0` and stay independent.

## Priority inside a version

Fixed, so "I renamed onto a slug that already exists" has one answer:

```
own file  >  tombstone  >  rename/redirect  >  alias  >  inherited
```

A slug backed by a file in this version — tombstone included — is never taken over by a rename or an
alias. An alias never shadows a page, inherited ones included: taking a slug away from real content
requires a real file or a tombstone.

## Redirects are inherited forward

A rename in `3.0.0` still redirects in `4.0.0`. The alternative would let an external link that worked
against `3.0.0` decay into a 404 the moment `4.0.0` shipped. There is a test that pins this, so the
decision cannot be reversed by accident.

Redirect chains are collapsed when the index is built, so `resolve()` is **terminal**: `to` always
names something servable and the caller never follows a second hop. A cycle cannot become an infinite
loop at request time; it becomes a diagnostic and the slugs involved resolve to nothing.

## `resolve()` outcomes

| Kind              | Meaning                                                                         |
| ----------------- | ------------------------------------------------------------------------------- |
| `own`             | A file in this version's own folder.                                            |
| `inherited`       | A file from further up the chain. `hops` and `source.definedIn` say where from. |
| `alias`           | Served here, but `canonical` is the page's real slug.                           |
| `redirect`        | Do not serve; `to` is a slug, `permanent` says which status code.               |
| `deleted`         | Removed in `deletedIn`, with `lastAvailable` and `replacedBy` when known.       |
| `missing`         | The version exists and has never had this page.                                 |
| `unknown-version` | The version itself does not exist. `nearest` suggests a fallback.               |

`deleted` is rich on purpose: an adapter can answer with an explanation instead of a bare 404.
`unknown-version` is a separate branch from `missing` because it wants a different answer — a hard
404 or a redirect, not a fallback to the version landing page.

## Say so, or inheritance is invisible

`inherited` leaves no trace in the URL. `/docs/next/authoring` and `/docs/authoring` render the same
file, and a reader on the newer one has no way to tell that nobody has touched the page since the
release — which is exactly what they would want to know before trusting it.

So the Fumadocs adapter reports the fact. A `page` resolution carries `inheritedFrom` when the browsing
version does not own the file, and **nothing at all** when it does:

```tsx
{route.inheritedFrom === undefined ? null : <Callout>Unchanged since {route.inheritedFrom.version}</Callout>}
```

The absence is the API: `if (route.inheritedFrom)` is the whole test, and a page a version owns keeps
the shape it always had. `hops` comes along for a consumer that wants to treat one version behind
differently from five.

Do not link to the defining version. It serves the very same file, so the link leads to identical
prose — the reader gains nothing and loses their place. If a project would rather say nothing at all,
`overlaySource({ inheritedNotice: false })` records that; it changes what is shown, never what
`resolve()` reports, so a consumer keeps every other option open.

You are reading this on `next`, which is the only version whose folder holds this page — so it is the
one page here with no notice at the top. The five around it have one.

## Truth table

Content:

```
1.0.0/  guide/intro.md  guide/stays.md  guide/old-api.md
2.0.0/  guide/intro.md              (override)
        guide/new-api.md            overlay: { renamedFrom: guide/old-api }
3.0.0/  guide/stays.md              overlay: { deleted: true, replacedBy: guide/modern }
        guide/modern.md
4.0.0/  guide/stays.md              (re-added)
```

| Slug            | 1.0.0       | 2.0.0       | 3.0.0               | 4.0.0               |
| --------------- | ----------- | ----------- | ------------------- | ------------------- |
| `guide/intro`   | `own`       | `own`       | `inherited` (2.0.0) | `inherited` (2.0.0) |
| `guide/stays`   | `own`       | `inherited` | `deleted`           | `own`               |
| `guide/old-api` | `own` (200) | `redirect`  | `redirect`          | `redirect`          |
| `guide/new-api` | `missing`   | `own`       | `inherited`         | `inherited`         |
| `guide/modern`  | `missing`   | `missing`   | `own`               | `inherited`         |

## Diagnostics

`createOverlay()` never throws for a content problem. It reports:

`unknown-version-folder`, `ambiguous-version-order`, `inherits-from-unknown`, `inheritance-cycle`,
`duplicate-slug`, `tombstone-without-target`, `rename-collision`, `alias-collision`, `redirect-cycle`,
`redirect-target-missing`, `meta-pages-completed`, `orphan-page`.

`overlay.diagnostics()` materialises every version first, so the list is complete rather than whatever
happened to have been folded.

## Cache and dependency graph

Indexes are built per version, on demand, and memoised. `overlay.getDependents(path)` returns every
`(version, slug)` whose resolution reads that file — stopping at the version that overrides or
tombstones the slug, and covering both sides of a branch.

`overlay.invalidate(paths)` measures the impact against the **current** state and _then_ discards it.
The order matters: for a deleted file, asking afterwards returns the new — empty — answer, and a dev
server would never learn which routes to refresh.
