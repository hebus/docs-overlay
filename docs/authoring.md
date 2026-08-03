# Authoring

## Folders are the versions

There is no `versions.json`. The list of versions _is_ the list of top-level folders under the content
root, ordered by semver, with declared non-semver folders (`next`) sorted last.

```
content/docs/
  1.0.0/      complete tree, frozen
  2.0.0/      differences only
  3.0.0/      differences only
  next/       work in progress
```

`2`, `3.1` and `v1.2.3` are all accepted as version numbers. A folder that is neither a version number
nor a declared channel is ignored with an `unknown-version-folder` diagnostic — never silently.

Declare channels so an empty one still exists as a version:

```ts
overlaySource({ source: docs.toFumadocsSource(), channels: ["next"] });
```

## The four operations

Every one of them is expressed **in the version that introduces it**, so a published version folder is
never edited again.

### Add a page

Write the file in the version that introduces it. Nothing else.

### Change a page

Write the file in the version that changes it. Older versions keep serving their own copy; newer ones
inherit yours until someone changes it again.

### Rename a page

`renamedFrom` on the **new** file:

```yaml
---
title: New API
overlay:
  renamedFrom: guide/old-api
---
```

From this version onwards the old slug is a permanent redirect. In older versions it is still a real
page with a 200 — the rename is spatial, not retroactive. A list works too:
`renamedFrom: [guide/old-api, guide/older-api]`.

### Delete a page

A **tombstone**: a file at the slug you are removing, in the version that removes it.

```yaml
---
title: Old API (removed)
overlay:
  deleted: true
  replacedBy: guide/new-api   # optional
---
```

The deletion version comes from the file's own path, so there is no version string to write and
nothing that can drift. `grep -rl 'deleted: true' content/docs/3.0.0/` lists exactly what disappears in
that release, which makes it reviewable in a pull request.

`recursive: true` removes the whole subtree under the page's folder rather than just the page.

## Aliases

A second slug for the same page, served with a canonical pointing at the real one:

```yaml
---
title: API
overlay:
  aliases: api-reference
---
```

An alias never shadows a page, inherited ones included. To take a slug away from real content, use a
real file or a tombstone.

## Cutting a release

```bash
git mv content/docs/next content/docs/5.0.0 && mkdir content/docs/next
```

Git records that as renames, so the content diff is **zero bytes**, and the emptied channel inherits
everything again. Compare with a snapshot-based tool, where the same operation copies the whole tree.

## Maintenance branches

Semver order alone puts every version on one line, which is wrong the moment a hotfix exists:
`11.13.1` should inherit from `11.13.0`, and so should `11.14.0`. Say so in code — there is still no
config file to maintain, and the version list is still just the folders:

```ts
overlaySource({
  source: docs.toFumadocsSource(),
  versions: {
    "11.14.0": { inheritsFrom: "11.13.0" },
    "11.13.1": { meta: { label: "11.13.1 (LTS)" } }
  }
});
```

## Navigation

`meta.json` is inherited whole, per directory. A version that ships its own replaces the inherited one
completely.

One trap is handled for you. A `meta.json` whose `pages` list is exhaustive — no `"..."` — hides
anything it does not name. Inherited into a version that added a page, that page would be routed and
indexed by search but **invisible in the sidebar**. So when an inherited list cannot possibly have
known about a name, `"..."` is appended and a `meta-pages-completed` diagnostic says so. Names the
authoring version omitted on purpose stay omitted, because they were already omissions then.

Add `"..."` yourself if you want to control where new pages land.

## Known limitation: i18n

Fumadocs' `i18n.parser: "dir"` consumes the first path segment — the same one the adapter uses for the
version. They cannot both own it, and `0.x` does not support the combination.
