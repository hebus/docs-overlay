# @docs-overlay/core

Framework-agnostic engine for **versioned documentation with overlay inheritance**.

The oldest version folder holds the complete tree; every newer version contains only its
differences. The core resolves a `(version, slug)` pair against that overlay chain and knows
nothing about any documentation framework — no React, no Next.js, no Fumadocs, no Node built-ins,
and zero runtime dependencies.

Framework integration lives in adapters, which depend on this package and never the other way
round:

- [`@docs-overlay/fumadocs`](../adapters/fumadocs) — Fumadocs / Next.js

See the [repository README](../../README.md) for the authoring convention and the full design.
