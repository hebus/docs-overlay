---
"docs-overlay-docusaurus": patch
---

Never write a generated stub as a folder's `index.mdx`, so it cannot become that folder's category index.

A stub whose slug also named a directory was written inside it as `index.mdx`, on the belief that a file
and a directory cannot share a name. They can — `customization.mdx` sits happily beside `customization/` —
and the special case was actively harmful: Docusaurus reads `index.mdx` as the **category index** of its
folder, so the stub became the category's `link` and supplied its label. A sidebar then read
`Moved to mint/configurations/customization/custom-json-files` where `Customization` belonged.

Two things made it easy to miss. The stub carries `unlisted: true`, but `isUnlisted()` in Docusaurus is
`isProduction(env) && frontMatter.unlisted` — so the flag is **inert in development**, and `npm start`
showed every stub while `docusaurus build` hid them. And once a stub is a category index it is no longer a
doc item, so a site filtering unlisted doc items out of its generated sidebars never sees it.

Written beside the directory, a stub is an ordinary page: same slug, same route, no category captured.
Verified on a real site in both modes — dev sidebar clean, all nine stub routes answering, production build
unchanged at 620 pages.

Related guidance, now in the adapter's readme: filter `unlisted` documents in your own
`sidebarItemsGenerator` rather than relying on the flag, so the sidebar is the same in development and in
production.
