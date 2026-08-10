# docs-overlay-cli

## 0.1.0

### Minor Changes

- 759323d: New package: the one command line.

  `cut` and `check` are universal; `materialize` is Docusaurus-specific and loads its adapter through a
  lazy `import()`, so a Fumadocs project installing this to move a folder never pulls Docusaurus knowledge
  in.

  - **`docs-overlay cut <version>`** — the channel folder becomes that version. Generalised from the script
    this repository already runs on itself, with its refusals intact: a version name the engine could not
    read would come back as a _warning_ and the whole cut would vanish from the site silently, so refusing
    is the lesser failure. Uses `git mv`, which renames the index entry and replays no clean filter — a
    copy-then-add renormalises every CRLF file and turns a zero-byte content diff into a full-tree rewrite.
  - **`docs-overlay check`** — the engine's diagnostics with no framework in the loop. Reachable in a second
    from a pre-commit hook, instead of costing a full build to discover a typo in a directive.
  - **`docs-overlay materialize [--check]`** — writes the tree Docusaurus reads. `--check` writes nothing
    and exits non-zero when the tree is out of date, which is what turns "somebody edited the generated
    `docs/`" from silent data loss into a failed build.

  Everything that touches the filesystem lives in one module, and it carries two rules. It **writes only
  where a manifest says it wrote before**: those paths are the ones a pre-migration site kept under source
  control, so an unrecognised target is refused rather than adopted — there is no `--force`, because
  adopting a committed tree means deleting it on the next run. And it **writes only when the bytes change**,
  because a churned mtime is what makes a dev server rebuild in a loop.

  The manifest also carries the `docs` plugin block, so a site with one config file per deployment target
  reads it rather than each file declaring `lastVersion` and `versions` for itself.

  Two traps it now refuses rather than reproduces, both met for real: a `--route-base-path` that arrives
  looking like `C:/Program Files/Git/` is MSYS argument conversion under Git Bash, and the value only ends
  up inside generated links, so it would fail by poisoning every one of them instead of crashing. And
  `npx docs-overlay` resolves the _engine_, which has no bin — the first invocation is `npx
docs-overlay-cli`, which the help text says.

### Patch Changes

- Updated dependencies [523a4bb]
  - docs-overlay@0.2.0
