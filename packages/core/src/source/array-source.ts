import type { ContentEntry, ContentSource } from "./content-source.js";

/** Wraps an already-materialised list of entries — the common case for every adapter. */
export function arrayContentSource<M>(entries: readonly ContentEntry<M>[], id?: string): ContentSource<M> {
  return {
    id,
    entries: () => entries
  };
}
