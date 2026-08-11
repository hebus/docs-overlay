# docs-overlay-docusaurus

**Stop copying `versioned_docs/`.** Author only the diff between versions, and let the build write the
snapshot tree Docusaurus insists on reading. The URLs come out identical, so nothing linked from outside
your site moves.

[![npm](https://img.shields.io/npm/v/docs-overlay-docusaurus?color=cb3837)](https://www.npmjs.com/package/docs-overlay-docusaurus)
[![licence MIT](https://img.shields.io/npm/l/docs-overlay-docusaurus?color=blue)](https://github.com/hebus/docs-overlay/blob/main/LICENSE)
[![documentation](https://img.shields.io/badge/docs-hebus.github.io-blue)](https://hebus.github.io/docs-overlay)

Docusaurus versions by snapshot: `docusaurus docs:version` copies the whole tree. A typo present in four
versions then takes four edits, and a reviewer cannot see from git what changed for readers between two
releases. This adapter is the Docusaurus half of [`docs-overlay`](https://www.npmjs.com/package/docs-overlay),
which inverts that — the oldest version folder holds the complete tree, every newer one holds only what
it changed, and the rest is inherited.

```bash
npm install docs-overlay docs-overlay-docusaurus
npm install -D docs-overlay-cli
```

You want [`docs-overlay-cli`](https://www.npmjs.com/package/docs-overlay-cli) as well: this package only
**plans** the tree, and `docs-overlay materialize` is what performs the write.

Three things you get that a plain Docusaurus site does not:

- a removed page explains itself — a tombstone carrying `replacedBy` becomes a real route, not a 404;
- a renamed page keeps its old URL working, with no redirect plugin to configure per version;
- the "new" and "updated" marks in the sidebar are **derived** from what each version actually added or
  changed, instead of a frontmatter field nobody recomputes when a version is cut.

## Why this one materialises

Docusaurus lets you configure exactly one source directory — the current version's. `versions.json`,
`versioned_docs/version-X/` and `versioned_sidebars/` sit at fixed paths, no option supplies a source
folder per version, and `readVersionsMetadata()` runs inside the content plugin's own factory, before
any hook of any plugin. There is no point at which an overlay could resolve inheritance on the fly.

The only window is **before the build**, and the only thing that fits through it is a real tree. So this
adapter plans one:

```
SOURCE (committed, diffs only)          GENERATED (gitignored)
content/docs/                           versions.json
  1.0.0/    complete tree         -->   versioned_docs/version-1.0.0/
  2.0.0/    what changed          -->   versioned_docs/version-2.0.0/
  next/     work in progress      -->   versioned_sidebars/version-*-sidebars.json
                                  -->   .docs-overlay/current/          (docs.path points here)
```

**The consequence is worth stating plainly, because it will surprise every contributor:** `docs/`,
`versioned_docs/`, `versioned_sidebars/` and `versions.json` become build output. You edit
`content/docs/` instead. A Docusaurus contributor's whole muscle memory says otherwise, and the honest
mitigation is a check in CI that turns the mistake into a failed build rather than silent data loss.

## It performs no I/O

`materialize()` returns a **description** of files to copy and files to write. The caller does the
writing. Two things follow.

Pages are **copied byte for byte**, never re-emitted. That is what keeps CRLF endings, encoding,
`import Tabs from '@theme/Tabs'`, `useBaseUrl`, and every mermaid block exactly as the author wrote
them. Only generated files — sidebars, the version list, stubs — carry `contents`.

And the adapter is testable with the same filesystem-free factories as the rest of the repository. It
mirrors the Fumadocs adapter, which also touches no disk: there because the framework does the reading,
here because the caller does the writing.

## Usage

```ts
import { createOverlay } from "docs-overlay";
import { docusaurusSlugify, materialize, readDocusaurusDirectives } from "docs-overlay-docusaurus";

const overlay = createOverlay({
  source: entries, // one ContentEntry per file, `<version>/<path>`, with parsed frontmatter as `meta`
  channels: ["next"],
  slugify: docusaurusSlugify(),
  readDirectives: readDocusaurusDirectives()
});

const plan = materialize(overlay, { routeBasePath: "/", labels: { next: "Next 🚧" } });

for (const file of plan.files) {
  if (file.kind === "copy") copyFileSync(file.from, join(siteDir, file.path));
  else writeFileSync(join(siteDir, file.path), file.contents);
}
```

`plan.docsOptions` is the block to spread into the `docs` preset options — `path`, `sidebarPath`,
`includeCurrentVersion`, `lastVersion` and `versions`. Deriving it rather than writing it is the point:
a site with two config files (one per deployment target) cannot have them disagree, and `lastVersion`
stops being a string somebody has to remember to bump.

URLs come out identical to a plain Docusaurus site: the newest release at the base URL, the channel at
`/next/…`, older versions at `/<version>/…`. Nothing linked from outside moves.

## Two identifier spaces, and why `docusaurusSlugify` exists

Sidebars reference **doc ids**. URLs and every overlay directive reference **slugs**. `atomic/index.md`
has the doc id `atomic/index` and the URL `/atomic`.

Docusaurus gives a file its folder's URL under three different names, all case-insensitively: `index`,
`README`, and a file named after its own folder. The engine's `createSlugify` knows one of the three, so
reimplementing it here is a correctness requirement rather than a convenience: get it wrong and the
engine resolves one slug while Docusaurus routes another, and every `renamedFrom`, `aliases` and
`replacedBy` aimed at that page silently misses.

The same distinction is a trap for authors. `replacedBy` takes a **slug**: for an index page that is the
folder, not `…/index`. A directive naming the doc id points at a route that does not exist, so the
adapter reports it rather than emitting a dead link.

## Navigation: inheritance prunes, it does not complete

A version keeps one `sidebars.json` at its root, inherited whole like any other metadata file. A version
that did not change its navigation ships none.

The contrast with the Fumadocs adapter is the instructive part, because the engine applied the same
inheritance to both without learning either format — and the remedies are mirror images. An inherited
Fumadocs `pages` list that omits a new page makes it _invisible_, so `appendRest()` **completes** it. An
inherited Docusaurus sidebar naming a doc this version no longer has makes Docusaurus **throw**
(`Invalid sidebar file … document with id "x" not found`), so `pruneMissing()` **prunes**. A harder
failure, and the opposite fix.

`pruneMissing()` drops references to docs a version does not serve, drops `autogenerated` blocks whose
directory holds nothing here, removes a category left with no items, and rewrites a reference to a page
that merely _moved_. It never adds: the symmetry with the content model is that **removals are
automatic, additions are declared**. Use `strictSidebars()` to see what pruning would have hidden.

## Every routable slug becomes a real route

`getEntries()` answers for more slugs than `getPages()`: an alias, an old slug that now redirects, a page
removed in this version. On a statically exported site a slug nobody generated is a 404, not a redirect,
so each one gets a generated page carrying `unlisted: true` — a route, kept out of sidebars, search and
the sitemap.

This is also why the adapter does not lean on `@docusaurus/plugin-client-redirects`: that plugin runs in
`postBuild`, after the route registry is fixed, so `onBrokenLinks: 'throw'` never sees its targets — an
internal link to a renamed page would fail the build even though the redirect exists. A stub is a route,
so the check passes, and the site saves a dependency. `plan.redirects` is still returned for anyone who
wants real HTTP redirects as well.

A removed page gets an explanation instead of a 404: what version removed it, which version still serves
it, and where to go instead when the author said. That is the most visible gain over a plain Docusaurus
site.

### Filter `unlisted` in your sidebar generator, do not rely on the flag

`unlisted` hides a page in **production only**: Docusaurus computes it as
`isProduction(env) && frontMatter.unlisted`, so in development the flag is inert and every stub comes back
into the sidebar. `docusaurus build` looks perfect while `npm start` shows nine "Moved to …" entries sitting
among the real documents — wrong every day, for the person actually writing the docs.

Filter them yourself, and the sidebar is the same in both environments:

```js
sidebarItemsGenerator: async ({ defaultSidebarItemsGenerator, ...args }) => {
  const items = await defaultSidebarItemsGenerator(args);
  const unlisted = new Set(args.docs.filter(doc => doc.frontMatter?.unlisted === true).map(doc => doc.id));

  const prune = list =>
    list
      .filter(item => !((item.type === "doc" || item.type === "ref") && unlisted.has(item.id)))
      .map(item => (item.type === "category" ? { ...item, items: prune(item.items) } : item))
      // Docusaurus refuses a category with no items, so an emptied one has to go.
      .filter(item => item.type !== "category" || item.items.length > 0);

  return prune(items);
};
```

This is not overlay-specific — it is what the flag reads as meaning.

## What each version added and changed, without anyone maintaining it

Sites mark fresh pages by hand, usually `sidebar_class_name: new` in the frontmatter. Nothing recomputes it
when a version is cut, so it decays. Measured on a real 216-page version: 8 pages carried the wrong mark,
65 that had changed carried none, and the **oldest** version — which has no predecessor to be new against —
still had six pages claiming to be new.

The overlay already knows, because owning a file _is_ the diff. A page a version supplies itself is a page
it changed, unless the version before it served no such slug, in which case it added it. So
`materialize()` returns it:

```ts
plan.changes; // [{ version: "1.0.0", added: [], changed: [] }, { version: "2.0.0", added: ["guide/extra"], changed: ["guide/intro"] }]
```

Doc ids, because that is the space sidebars reference. Two deliberate silences: the **oldest version marks
nothing** (every page is owned, so calling them all new says nothing), and **categories are left alone** —
a category is not a document, and marking one would raise whether it means its own index page or anything
beneath it.

Marking the sidebar takes two mechanisms, and that is not a design choice — it is where the framework
splits the work. Authored entries exist at materialisation time, so `changeClassNames` handles them:

```ts
materialize(overlay, { changeClassNames: { added: "is-new", changed: "is-changed" } });
```

An `autogenerated` block's items do not exist until Docusaurus expands the directory at build time, long
after. Those are yours, from the same two sets:

```js
sidebarItemsGenerator: async ({ defaultSidebarItemsGenerator, ...args }) => {
  const items = await defaultSidebarItemsGenerator(args);
  const { added, changed } = changesFor(args.version.versionName); // from plan.changes, however you carried it
  const mark = id => (added.has(id) ? "is-new" : changed.has(id) ? "is-changed" : undefined);
  // …set className on doc items from `mark`, recursing into categories
};
```

A renamed page counts as **added**, because its slug is one the predecessor did not serve — which is what a
reader arriving at that URL experiences. An authored `className` is kept and the new one appended, so a site
can go on using the field for something the adapter knows nothing about, such as `deprecated`.

## `docusaurus serve` cannot open a version landing page

Not a fault in the materialised tree, and worth knowing before it wastes an afternoon.

Each release routes under a segment made of digits and dots — `build/1.0.0/index.html` — and
`serve-handler`, which `docusaurus serve` is built on, reads a dotted segment as a filename with an
extension. It therefore never looks for `index.html` inside the directory:

```text
/1.0.0/              404          the file is right there, 10 kB of it
/1.0.0/index.html    301 → /1.0.0/    which 404s
/next/               200          no dot in the name
/1.0.0/guide/x/      200          the dot is not in the last segment
```

**The deployed site is unaffected** — GitHub Pages serves `/1.0.0/` and `301`s the form without a
trailing slash. This is a local-preview problem, so preview with something else:

```bash
npx http-server build -c-1
```

Whatever you deploy to, open **a version landing page** once, deliberately. It is the URL shape nothing
else on a normal site produces, and the one a reader reaches by picking a version from the dropdown.

## What is not supported

Versioned i18n. Docusaurus keeps translations under `i18n/<locale>/docusaurus-plugin-content-docs/`,
keyed by version, and `0.x` does not fold that second axis.

## Diagnostics

`materialize()` never throws for a content problem — it returns `diagnostics`, like everywhere else in
the engine. Report them and fail the build on `severity: "error"`; that is the same bar
`onBrokenLinks: 'throw'` sets for links.

## Documentation

A working site is in
[`examples/docusaurus-classic`](https://github.com/hebus/docs-overlay/tree/main/examples/docusaurus-classic) —
two releases and a channel, built with `onBrokenLinks: "throw"`, with 35 assertions against the exported
HTML. Clone it, `npm ci`, `npm start`.

**[Versioning Docusaurus documentation without snapshots](https://hebus.github.io/docs-overlay/docs/staying-on-docusaurus/)**
is the walkthrough: moving your snapshots into an overlay, wiring the build, and proving the result did
not lose anything. The concepts common to every adapter are
[Authoring](https://hebus.github.io/docs-overlay/docs/authoring/) and
[Resolution](https://hebus.github.io/docs-overlay/docs/resolution/).

If you were going to change framework anyway,
[Migrating to Fumadocs](https://hebus.github.io/docs-overlay/docs/migrating-to-fumadocs/) is the shorter
road, and [`docs-overlay-fumadocs`](https://www.npmjs.com/package/docs-overlay-fumadocs) needs no
materialisation at all.

## Licence

[MIT](https://github.com/hebus/docs-overlay/blob/main/LICENSE)
