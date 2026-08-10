# docs-overlay-cli

The one command line for [`docs-overlay`](https://www.npmjs.com/package/docs-overlay).

```bash
npm install -D docs-overlay-cli
```

> The first invocation is `npx docs-overlay-cli`, not `npx docs-overlay`: the latter resolves the
> _engine_ package, which has no bin, and fails with nothing useful to say. Afterwards the
> `docs-overlay` bin works from package scripts and `npm exec`.

## Commands

```
docs-overlay cut <version>             the channel folder becomes that version
docs-overlay check                     the engine's diagnostics, no framework needed
docs-overlay materialize [--check]     write the tree Docusaurus reads   (needs docs-overlay-docusaurus)
```

`cut` and `check` are universal. `materialize` loads the Docusaurus adapter through a lazy `import()`, so
a Fumadocs project installing this to move a folder never pulls Docusaurus knowledge in.

Run `docs-overlay --help` for the flags.

## Two rules, and why they are not configurable

**It writes only where a manifest says it wrote before.** A generated tree lives at the paths Docusaurus
hardcodes — the same paths a site had under source control before migrating. So a target that exists and
carries no sentinel is _refused_, with the `git rm -r --cached` to run. There is no `--force` and no
`--adopt`: adopting a committed tree means deleting it on the next run, which is the silent destruction
the refusal exists for. Taking that step is a human's job, once, on purpose.

**It writes only when the bytes change.** Rewriting an identical file churns its mtime, and a churned
mtime is what makes a dev server rebuild in a loop.

## Wiring a Docusaurus site

```json
{
  "scripts": {
    "materialize": "docs-overlay materialize",
    "verify": "docs-overlay materialize --check",
    "prebuild": "npm run materialize",
    "prestart": "npm run materialize"
  }
}
```

`materialize --check` belongs in CI. After this migration `docs/` is generated, and editing it is muscle
memory for every Docusaurus contributor — the check is what turns that mistake into a failed build instead
of an edit that disappears at the next build without a trace.

The manifest carries the `docs` plugin block, so a site with one config file per deployment target reads
it rather than each file declaring `lastVersion` and `versions` for itself.

## Running it by hand under Git Bash

MSYS rewrites arguments that look like absolute POSIX paths, so `--route-base-path /` reaches the process
as `C:/Program Files/Git/`. The command refuses such a value rather than quietly building every generated
link on top of it. Either run it from a package.json script, where no conversion happens, or exclude the
flag: `MSYS2_ARG_CONV_EXCL='--route-base-path=' docs-overlay ... --route-base-path=/`. Excluding
everything with `'*'` also stops `--site-dir` being converted, which then reaches Node as an unresolvable
`/c/...` path.
