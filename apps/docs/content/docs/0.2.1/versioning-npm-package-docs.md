---
title: Versioning documentation for an npm package
description: Keep the documentation in step with what is published — a folder per released version, a channel for unreleased work, and prereleases and unsupported versions that behave.
---

Someone installed `1.2.0` six months ago. They open your documentation and read about a function that
does not exist in the version they have, because the site serves whatever is on the default branch.

That is the whole problem, and it has one shape: **the site needs a version for every version you
support, and the docs for each must stop changing when that version ships.**

## A folder per released version, and a channel for the rest

```text
content/docs/
  1.0.0/          the complete tree
  2.0.0/          what changed in 2.0.0
  2.1.0/          what changed in 2.1.0
  next/           unreleased work — often empty
```

The rule that makes this work is that unreleased documentation lives in the **channel**, never in a
released folder. A folder named after a published version answers "what did this version say", and the
answer has to keep being true. Write in `next/`, and cutting the release is what promotes it — see
[Cutting a release](./authoring.md#cutting-a-release).

You do not need a folder per patch. Cut one when the documentation actually differs; a patch that
changed no prose needs no folder, and readers of `2.1.3` are served `2.1.0`'s pages, which are correct
for them.

## Point readers at their own version

Two links do most of the work, and only one of them is the obvious one:

- **`/docs/`** — with `latestAtRoot`, the newest release. This is the link for your readme, your npm
  page and your website, and it never has to be updated.
- **`/docs/1.2.0/…`** — a specific release. This is the link for a changelog entry, a migration guide, or
  an issue reply: it keeps saying what it said when you wrote it.

The second is the one people forget exists, and it is the reason a reader on an old version is not stuck.

## Prereleases

`1.0.0-beta.1` is a version the engine reads, and it sorts **before** `1.0.0` — so a beta's folder
inherits from whatever preceded it, and the stable release that follows inherits from the beta. `cut`
accepts one and says so:

```bash
docs-overlay cut 2.0.0-rc.1
```

A prerelease is never `latest`, so it will not be served at the root. That is usually what you want: the
people reading a release candidate's documentation went looking for it.

Whether to keep the folder afterwards is a judgement. Keeping it preserves the URLs you shared while the
release candidate was current; removing it once the stable release exists keeps the version list short.
Removing it means deleting the folder — its pages were only ever a diff, so nothing else has to change.

## A version you no longer support

Do not delete it. An old version's folder is the only place its pages exist, and removing it turns every
link anyone ever wrote into a 404. Label it instead, so a reader who lands there knows where they are:

```ts
overlaySource({
  source: docs.toFumadocsSource(),
  channels: ["next"],
  versions: {
    "1.0.0": { meta: { label: "1.0.0 (unsupported)" } }
  }
});
```

The label is display only — nothing about resolution changes, and the version goes on serving what it
always served.

## Removing a page without breaking its URL

A function you dropped in `2.0.0` should not leave its documentation reachable as though it still worked,
and it should not 404 either. A tombstone in the version that removes it does both:

```yaml
---
title: parseLegacy
overlay:
  deleted: true
  replacedBy: api/parse
---
```

`1.0.0` still serves the real page, because that is where it existed. `2.0.0` onwards answers the same
URL with an explanation naming its replacement and the last version that had it. Nobody edits a
published folder, and no reader hits a dead end.

## Keeping it automatic

The cut belongs to whatever already knows a release happened. With Changesets, that is the version pull
request:

```json
{
  "scripts": {
    "changeset:version": "changeset version && node scripts/cut-docs.mjs"
  }
}
```

This site is built that way — the folder takes the engine's version, and a release of an adapter alone
cuts nothing. The reasoning, and what happens when several packages disagree about whose version the
folder should take, is in
[Versioning documentation in a monorepo](./versioning-in-a-monorepo.md#which-packages-version-the-folder-takes).

## Read next

- [Authoring](./authoring.md) — the operations, in full.
- [The command line](./cli.md) — `cut`, `check`, `prune`.
- [Versioning documentation in a monorepo](./versioning-in-a-monorepo.md) — several packages on separate
  schedules.
