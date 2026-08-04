---
"docs-overlay-fumadocs": minor
---

Serve several documentations from one site, each versioned on its own. `overlaySource({ scope })` names
the product an instance serves: its version folders live under `content/docs/<scope>/`, its URLs start
at `/docs/<scope>/`, and it has its own `latest` — so a monorepo publishing packages on separate
schedules no longer needs one version list for all of them. Several scoped instances feed a single
`loader()`, which keeps one page tree, one search index and working relative links; the scope reaches
paths, slugs and params, so two products holding the same slug no longer overwrite each other.
`resolveRoute()` refuses a scope that is not its own instead of looking for it as a page of the root
version, and the new `searchTagsOf()` tags an index entry with both product and version — `versionTagOf()`
would report the product once a scope exists. Leaving `scope` out changes nothing.
