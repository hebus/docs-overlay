---
title: Stays (removed in 3.0.0)
description: Tombstone.
overlay:
  deleted: true
  replacedBy: guide/modern
---

A tombstone: a file at the slug it removes, in the version that removes it. The deletion version comes
from this file's own path, so there is nothing to keep in sync, and
`grep -rl 'deleted: true' content/docs/3.0.0/` lists every removal of the release.
