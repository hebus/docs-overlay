---
"docs-overlay-mermaid": patch
---

Accept a hyphen inside a flowchart node id, and keep a quoted inline label whole.

`user-service --> api-gateway` is idiomatic Mermaid and used to be a syntax error: the id stopped at the hyphen and the rest of the word was read as a broken link. A hyphen now continues an id when a word character follows it, which leaves a link written without spaces alone — `A-->B`, `a-b-->c-d` and `x-.->y` all still parse as links.

`A -- "a--b" --> B` also works now. Unquoted, the `--` inside the label closed the link early and the remainder became a phantom node: `A -- a--b --> B` came out as three nodes. The scanner steps over a quoted span instead, which makes quoting a real escape hatch rather than advice that did not work. Unquoted is still read as a link, and the readme says so.
