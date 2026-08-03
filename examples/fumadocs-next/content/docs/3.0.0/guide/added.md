---
title: Added in 3.0.0
description: The page that proves navigation inheritance is handled.
---

`guide/meta.json` is inherited from 1.0.0, where it lists four pages and **no** `"..."`. Left alone,
this page would be routed and indexed by search but invisible in the sidebar — silent, and the most
likely failure in real use. The adapter appends `"..."` because that inherited list cannot possibly
have known about this file, and says so with a `meta-pages-completed` diagnostic.
