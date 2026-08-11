---
"docs-overlay-fumadocs": patch
---

Documentation served from the site root no longer gets a doubled separator in every URL.

`baseUrl: "/"` — the shape a site publishes when its documentation _is_ the site, which Docusaurus writes
as `routeBasePath: '/'` — reached three template literals that appended their own separator to a base that
already ended in one. The result was `//mint/features/preview`, which a browser reads as protocol-relative
and resolves against a host named `mint`: every page link, every version landing page, every canonical and
every redirect target left the site.

The three sites now share an internal `joinUrl()` helper, so the root case is handled once rather than at
each call. Nested base URLs are unchanged, with or without a trailing slash.
