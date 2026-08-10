---
title: Writing an adapter
description: What the engine gives you, the two shapes an adapter takes, and the details that break a site quietly.
---

An adapter maps the overlay engine onto one documentation framework. It depends on
`docs-overlay`; the core never depends on it.

## Two shapes, and the framework decides which

There are two reference implementations now, and they are worth comparing before you write a third,
because the difference is not a matter of taste.

|                      | `docs-overlay-fumadocs`                             | `docs-overlay-docusaurus`                                  |
| -------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| shape                | **re-projects** a source the framework already read | **materialises** the tree the framework insists on reading |
| when it runs         | while the framework loads content                   | before the build                                           |
| what it returns      | a source the framework's `loader()` consumes        | a description of files to copy and files to write          |
| navigation unit      | one `meta.json` per directory                       | one `sidebars.json` at the version root                    |
| inheritance's remedy | **completes** the list (`appendRest`)               | **prunes** the list (`pruneMissing`)                       |
| touches the disk     | no — the framework read it                          | no — the caller writes it                                  |

**Re-project when the framework will let you supply content.** Fumadocs hands you what it read, you fold
it, and you hand back a source. Nothing is written.

**Materialise when it will not.** Docusaurus allows exactly one configurable source directory,
`versioned_docs/version-X/` and friends live at fixed paths, and its docs plugin reads its version
metadata inside its own factory — before any hook of any plugin. There is no point at which an overlay
could resolve inheritance on the fly, so the only window is before the build, and the only thing that fits
through it is a real tree.

Neither one performs I/O, and keep it that way in a third: it is what lets an adapter be tested with plain
factories instead of a filesystem, and it puts every rule about not destroying somebody's files in exactly
one place.

The contrast in the last two rows is the instructive part, because **the core applied the same inheritance
to both without learning either format.** An inherited Fumadocs `pages` list that omits a newly added page
makes it invisible, so that adapter completes the list. An inherited Docusaurus sidebar that names a page
this version removed makes Docusaurus _throw_ — `These sidebar document ids do not exist` — so that adapter
prunes it. A harder failure, and the opposite fix, from the same engine.

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
planSnapshots(snapshots);                 // and, for a migration, N full trees → an overlay plan
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

Three details are easy to get wrong and each breaks the site quietly:

- **Rewrite the path into the browsing version's space.** Whatever your framework keys relative links
  on has to point inside the version the reader is on, not at the file's own folder. A materialiser meets
  this in its most literal form — write an inherited page at its own `source.path` and the file lands in
  the wrong version's folder.
- **Assign slugs explicitly.** In Fumadocs, deriving them yields the same slug for every version and the
  build fails with `Duplicated slugs`. In Docusaurus the collision cannot happen — each version is its own
  id space — but the requirement returns in a nastier form: a page carrying `slug: /faq` in its frontmatter
  is routed there, and an engine that resolved it from the path instead would express every directive
  against a URL that does not exist, with nothing to report because both sides look internally consistent.
- **Pass `meta` by reference, never cloned.** In Fumadocs that is what lets a page served by five versions
  compile to one chunk, and a `toBe()` assertion protects it. In a materialiser the performance argument
  disappears — five files means five modules — but the rule survives as a _mutation_ hazard: `meta` is the
  same object for every version serving that page, so rewriting frontmatter "for this version" corrupts the
  others, with a bug that depends on fold order and is therefore unreproducible. Treat it as frozen input
  and build the per-version output at write time.

Keep `origin` pointing at the **defining** file even though the path says otherwise: that is what
"edit this page" and last-modified want — and, in a materialiser, it is the handle you copy the bytes from.

## Enumerate every routable slug, not just pages

`getPages()` gives pages. Aliases, old slugs and removed pages are addressable too, and each wants a
different answer — a canonical, a redirect, an explanation. Use `getEntries()`, or the whole point of
the resolver is lost at the routing layer. On a static host an un-generated route is a 404, not a
redirect.

If you generate a **page** to serve one of those slugs, do not then count it as a page of the version.
Doing so makes the slug look alive to the navigation merger: a tombstoned entry stays in the sidebar, and a
rename is never rewritten because the old id still appears to resolve. It is a route, not a page.

## Keep framework concepts out of the core

If you find yourself wanting to teach the core about your framework's navigation format, inject a
callback instead. `mergeMeta` exists for exactly that reason: Fumadocs' `pages: []` grammar
(`"..."`, `"z...a"`, `"!x"`, `"[Title](url)"`, `root: true`) is understood entirely inside the adapter, and
the Docusaurus sidebar grammar entirely inside its own.

Presentation belongs to you as well. `Version.meta` is an opaque payload the core carries and never
reads — labels, EOL status and anything else live there, and the adapter decides what they mean.

## Make the rules executable

Both adapters carry an architecture test, because TypeScript cannot catch either rule: npm hoists every
workspace dependency, so a stray `import` of a framework — or of `node:fs` in an adapter that claims to
perform no I/O — resolves and compiles perfectly, then breaks in a consumer's project.

Two things learned writing the second one. Scanning sources as text cannot tell an import from a string
that merely contains one: the Docusaurus adapter legitimately _emits_ MDX importing `@docusaurus/router`,
inside a template literal, and a naive check reports it as a violation. Strip template literals first — and
add a test proving the stripper does not swallow a real import, or the whole check silently passes on
anything. And keep Node's ambient types out of the adapter's own `src` project, in a separate test project
if need be: with `process` and `Buffer` in scope, "performs no I/O" becomes a stated intention rather than a
checkable claim.
