# docs-overlay-cli

**The one command line for [`docs-overlay`](https://www.npmjs.com/package/docs-overlay)** — cut a
version, check content, drop files a version repeats, and materialise the tree Docusaurus reads.

[![npm](https://img.shields.io/npm/v/docs-overlay-cli?color=cb3837)](https://www.npmjs.com/package/docs-overlay-cli)
[![licence MIT](https://img.shields.io/npm/l/docs-overlay-cli?color=blue)](https://github.com/hebus/docs-overlay/blob/main/LICENSE)
[![documentation](https://img.shields.io/badge/docs-hebus.github.io-blue)](https://hebus.github.io/docs-overlay)

```bash
npm install -D docs-overlay-cli
```

> The first invocation is `npx docs-overlay-cli`, not `npx docs-overlay`: the latter resolves the
> _engine_ package, which has no bin, and fails with nothing useful to say. Afterwards the
> `docs-overlay` bin works from package scripts and `npm exec`.

## Commands

```text
docs-overlay cut <version>             the channel folder becomes that version
docs-overlay check                     the engine's diagnostics, no framework needed
docs-overlay prune                     drop files a version repeats from what it inherits
docs-overlay materialize [--check]     write the tree Docusaurus reads   (needs docs-overlay-docusaurus)
```

`cut`, `check` and `prune` are universal — they work on any repository following the folder convention,
Fumadocs sites included, with nothing but this package installed. `materialize` writes the tree a
framework reads, which is the one job with no framework-neutral form, so it is the only command that needs
[`docs-overlay-docusaurus`](https://www.npmjs.com/package/docs-overlay-docusaurus) — declared as an
optional peer dependency, and loaded through `import()` rather than carried in the bundle.

### Dialects

Reading a tree means deciding two things: how a file path becomes a slug, and which file carries the
navigation. Both are framework-specific, so both are chosen rather than assumed.

```text
--dialect docusaurus   Docusaurus' own slug rules, and sidebars.json for navigation
--dialect generic      path-derived slugs, no navigation file
```

The default is `docusaurus` when the site has a `docusaurus.config.*`, and `generic` otherwise. Every
command that reads a tree prints which one it used, and why.

This is not cosmetic: the two derive **different** slugs — Docusaurus strips number prefixes and gives
three different file names the URL of their folder — so reading a Docusaurus tree generically would point
every overlay directive at a URL that does not exist, with nothing to report, because both sides would look
internally consistent. Two things keep that from happening quietly. A Docusaurus site whose adapter is not
installed is an error rather than a silent downgrade to the generic rules. And a `sidebars.json` found
while reading generically fails the command rather than being carried along as an ordinary file — `prune`
checks before it removes anything. Pass `--dialect generic` to confirm the generic rules are what you want.

Options common to all four: `--site-dir <path>` (default: the nearest ancestor with a
`docusaurus.config.*`), `--content-dir <path>` (default: `<site-dir>/content/docs`), `--out-dir <path>`
(what the tool owns and may delete; default `.docs-overlay`), `--channel <name>` (repeatable, default
`next`), `--route-base-path <path>`, `--label <id=text>` (repeatable), `--dialect <name>`, `--json`.

An unknown flag is an **error**, not a warning. A mistyped `--dry-run` that silently did the real work
is the one failure this tool cannot afford.

### `cut <version>`

Renames the channel folder to that version and re-creates the channel empty. Git records it as renames,
so the content diff is zero bytes, and the emptied channel immediately inherits everything again.

```bash
docs-overlay cut 2.0.0
```

`--dry-run` prints what would move. `--no-git` does a plain filesystem move, which does not preserve
history — `git mv` is the default for a reason: a copy-then-add would renormalise every CRLF file and
turn a pure rename into a full-tree rewrite.

It refuses a name the engine would not read as a version (that would be a _warning_ at build time, and
the whole folder would vanish from the site silently), a channel that is missing or holds no content
yet, and a target folder that already exists.

### `check`

Runs the engine's diagnostics — duplicate slugs, tombstones with no target, redirect cycles, unknown
version folders — with no framework build. Seconds, so it belongs on every content pull request.

```bash
docs-overlay check --fail-on warning
```

`--fail-on error|warning` sets the bar (default `error`). `--json` for machine-readable output.

### `prune`

Deletes the files a version repeats **byte** for byte from what it inherits. The resolved site is
**identical** afterwards — the slug is simply served by inheritance instead of by a duplicate file. A
file carrying an `overlay:` directive is kept even when its bytes match, since removing it would take
the rename or the alias with it.

```bash
docs-overlay prune --dry-run
```

`--version-id <V>` targets one version; the default is every version but the oldest, which inherits
nothing. `--no-git` unlinks instead of `git rm`.

This is not only a migration step. Anything that writes into a version folder wholesale — a script
mirroring documentation out of a library repository, a backport onto another branch — recreates an
override for every file it touches, including the ones identical to what they inherit. Nothing breaks,
so nothing reports it, and the repository quietly re-inflates until the overlay stops meaning anything.

### `materialize`

Writes the tree Docusaurus reads: `versions.json`, `versioned_docs/version-*/`,
`versioned_sidebars/*.json` and the current version's directory. Requires
[`docs-overlay-docusaurus`](https://www.npmjs.com/package/docs-overlay-docusaurus).

```bash
docs-overlay materialize --check
```

`--check` writes nothing and exits 1 when the tree is out of date. `--no-clean` keeps files a previous
run wrote that this one does not. `--allow-errors` finishes despite content errors. `--mark-added
<class>` and `--mark-changed <class>` set the class on sidebar entries a version adds or changes — both
reach authored entries only, and the manifest carries the same two sets so a `sidebarItemsGenerator` can
mark the autogenerated ones.

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
    "check": "docs-overlay check",
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

## Documentation

`docs-overlay --help` prints every flag. The walkthrough for a Docusaurus site is
[Versioning Docusaurus documentation without snapshots](https://hebus.github.io/docs-overlay/docs/staying-on-docusaurus/);
the content model itself is [Authoring](https://hebus.github.io/docs-overlay/docs/authoring/).

## Licence

[MIT](https://github.com/hebus/docs-overlay/blob/main/LICENSE)
