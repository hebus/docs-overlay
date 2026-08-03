---
title: Writing an adapter
description: What the engine gives you, and the three details that break a site quietly.
---

An adapter maps the overlay engine onto one documentation framework. It depends on
`docs-overlay`; the core never depends on it.

## What the core gives you

```ts
const overlay = createOverlay<Meta>({
  source: { entries: () => myEntries },   // or an array
  channels: ["next"],
  versions: { "11.14.0": { inheritsFrom: "11.13.0" } },
  readDirectives: entry => myConvention(entry),  // defaults to entry.meta.overlay
  onDiagnostic: report
});

overlay.versions;                         // oldest first, with `inheritsFrom` resolved
overlay.latest;                           // highest release, channels excluded
overlay.getPages(version);                // every page a version serves
overlay.getEntries(version);              // every slug it answers for, page or not
overlay.resolve(version, slug);           // the seven-branch outcome
overlay.getMetas(version);                // navigation files, inherited per directory
overlay.getRedirects(version?);           // slug → slug rules
overlay.getDependents(path);              // what a changed file affects
overlay.invalidate(paths?);               // re-read, and report what went stale
overlay.diagnostics();                    // every content problem found
```

## Feeding it

Turn whatever your framework already produced into `ContentEntry[]`. The first path segment must be the
version folder:

```ts
interface ContentEntry<M> {
  path: string;        // "11.14.0/guide/api.mdx"
  kind: "page" | "meta";
  meta: M;             // opaque to the core
  slug?: readonly string[];
  origin?: string;     // your handle back to the real file
}
```

Pass a **function** as `source` if you want `invalidate()` to see files appear and disappear; a plain
array is read once.

## Emitting

Three details are easy to get wrong and each breaks the site quietly. The Fumadocs adapter is the
reference:

- **Rewrite the path into the browsing version's space.** Whatever your framework keys relative links
  on has to point inside the version the reader is on, not at the file's own folder.
- **Assign slugs explicitly**, prefixed with the version. Leaving them to be derived from the original
  frontmatter yields the same slug for every version — Fumadocs answers that with
  `Duplicated slugs` and a failed build.
- **Pass `meta` by reference, never cloned.** A page served by five versions should still compile to
  one chunk. There is a `toBe()` assertion protecting this.

Keep `origin` pointing at the **defining** file even though the path says otherwise: that is what
"edit this page" and last-modified want.

## Enumerate every routable slug, not just pages

`getPages()` gives pages. Aliases, old slugs and removed pages are addressable too, and each wants a
different answer — a canonical, a redirect, an explanation. Use `getEntries()`, or the whole point of
the resolver is lost at the routing layer. On a static host an un-generated route is a 404, not a
redirect.

## Keep framework concepts out of the core

If you find yourself wanting to teach the core about your framework's navigation format, inject a
callback instead. `mergeMeta` exists for exactly that reason: Fumadocs' `pages: []` grammar
(`"..."`, `"z...a"`, `"!x"`, `"[Title](url)"`, `root: true`) is understood entirely inside the adapter.

Presentation belongs to you as well. `Version.meta` is an opaque payload the core carries and never
reads — labels, EOL status and anything else live there, and the adapter decides what they mean.
