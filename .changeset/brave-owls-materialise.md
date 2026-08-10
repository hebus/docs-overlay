---
"docs-overlay-docusaurus": minor
---

New package: a Docusaurus adapter that plans the tree Docusaurus insists on reading from disk.

Docusaurus lets you configure exactly one source directory — the current version's. `versions.json`,
`versioned_docs/version-X/` and `versioned_sidebars/` sit at fixed paths, no option supplies a source
folder per version, and `readVersionsMetadata()` runs inside the content plugin's factory, before any
hook of any plugin. There is no point at which an overlay could resolve inheritance on the fly, so the
adapter materialises instead: the only window is before the build, and the only thing that fits through
it is a real tree.

It performs no I/O. `materialize()` returns a description of files to **copy** and files to **write**,
and the caller writes them — which keeps it testable with the same filesystem-free factories as the rest
of the repository, and mirrors the Fumadocs adapter, which touches no disk either. Pages are copied byte
for byte rather than re-emitted, so line endings, encoding and every MDX import survive untouched.

- `docusaurusSlugify()` reproduces Docusaurus' slug rules: `index`, `README` and a file named after its
  own folder all take the folder's URL, case-insensitively. Getting this wrong makes the engine resolve
  one slug while Docusaurus routes another, and every directive aimed at that page silently misses.
- `pruneMissing()` is the mirror image of the Fumadocs merger. An inherited `pages` list that omits a new
  page makes it invisible, so Fumadocs completes it; an inherited sidebar naming a doc this version
  removed makes Docusaurus _throw_, so this prunes. The engine applied the same inheritance to both
  without learning either format.
- Every routable slug becomes a real route, not only the pages: aliases, old slugs and removed pages each
  get a generated `unlisted` stub. On a static host an un-generated slug is a 404 rather than a redirect,
  and `onBrokenLinks: 'throw'` cannot see targets that `@docusaurus/plugin-client-redirects` adds in
  `postBuild` — so a stub is both the correct answer and one dependency fewer. Verified on a real build:
  the stub answers 200 and its slug does not appear in the rendered sidebar.
- Generated links carry no `baseUrl`; the page resolves it with `useBaseUrl` at build time. One
  materialisation therefore serves every deployment target, and `materialize --check` in CI does not
  depend on which target ran last.
- `docsOptions` is derived rather than written, so a site with one config file per deployment target
  cannot have them disagree about `lastVersion` or `versions`.

Nothing here imports Docusaurus, at runtime or in types: the sidebar shape is described structurally, so
a consumer needs no `@docusaurus/*` package installed in order to typecheck against this one. An
architecture test makes both claims executable.
