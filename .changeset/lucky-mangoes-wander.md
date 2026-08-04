---
"docs-overlay-fumadocs": minor
---

Report where an inherited page comes from, so a reader is not left thinking they are reading a version
that never touched it. `resolveRoute()` now returns `inheritedFrom: { version, hops }` on a `page`
resolution whose file the browsing version does not own — absent when it does, so an owned page keeps
the shape it had. Aliases carry it too. The new `inheritedNotice` option of `overlaySource()` (default
`true`) records whether a project wants that shown; it is carried for the rendering layer to honour and
never changes what `resolveRoute()` reports.
