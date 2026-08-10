---
"docs-overlay-cli": patch
---

Republish with the `dist/` that `0.1.0` shipped without.

`0.1.0` packed `bin/`, `README.md`, `LICENSE` and nothing else: the package was missing from the root
`build` script, so nothing ever built it, `npm pack` packed what it found, and the tarball went out with no
`dist/` at all. Installing it and running the bin failed two repositories away, as
`ERR_MODULE_NOT_FOUND` on `docs-overlay-cli/dist/cli.js`.

No code changed. `0.1.0` is deprecated on npmjs in favour of this version.

The release script now refuses to publish a package whose declared `files` are missing or empty, which is
the check that would have caught it. That is deliberately a check on the artefacts rather than one more
list to keep in step: the same omission had already happened across `build`, `typecheck`,
`typecheck:packaged` and the release list, and a fifth list would only have been a fifth thing to forget.
