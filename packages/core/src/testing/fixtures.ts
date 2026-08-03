import { createOverlay, type Overlay, type OverlayOptions } from "../create-overlay.js";
import type { OverlayDirectives } from "../models/page.js";
import { arrayContentSource } from "../source/array-source.js";
import type { ContentEntry, ContentSource } from "../source/content-source.js";

/** Test metadata is a plain bag: the core never looks inside it beyond the `overlay` key. */
export type Meta = Record<string, unknown>;

/**
 * Fixtures are TypeScript factories, never files on disk — the core is filesystem-free and its
 * tests must stay that way. `title` defaults to the path so an assertion can tell which physical
 * file won a resolution.
 */
export function page(path: string, meta: Meta = {}): ContentEntry<Meta> {
  return { path, kind: "page", meta: { title: path, ...meta }, origin: `/abs/${path}` };
}

export function metaFile(path: string, meta: Meta = {}): ContentEntry<Meta> {
  return { path, kind: "meta", meta: { ...meta }, origin: `/abs/${path}` };
}

export function withDirectives(path: string, overlay: OverlayDirectives, meta: Meta = {}): ContentEntry<Meta> {
  return page(path, { ...meta, overlay });
}

/** A page removed from this version onwards. */
export function tombstone(path: string, extra: OverlayDirectives = {}): ContentEntry<Meta> {
  return withDirectives(path, { deleted: true, ...extra });
}

/** A page that used to live at `from`, so `from` becomes a permanent redirect. */
export function renamed(path: string, from: string | readonly string[]): ContentEntry<Meta> {
  return withDirectives(path, { renamedFrom: typeof from === "string" ? [from] : from });
}

export function fixtureSource(...entries: readonly ContentEntry<Meta>[]): ContentSource<Meta> {
  return arrayContentSource(entries, "fixture");
}

export function overlayOf(entries: readonly ContentEntry<Meta>[], options: Omit<OverlayOptions<Meta>, "source"> = {}): Overlay<Meta> {
  return createOverlay<Meta>({ source: entries, ...options });
}

export interface MutableSource {
  readonly source: ContentSource<Meta>;
  set(entries: readonly ContentEntry<Meta>[]): void;
  add(...entries: readonly ContentEntry<Meta>[]): void;
  remove(...paths: readonly string[]): void;
  replace(entry: ContentEntry<Meta>): void;
  /** How many times the overlay has re-read the source. */
  readonly reads: number;
}

/** A source whose content can change between calls, which is what `invalidate()` needs to be testable. */
export function mutableSource(initial: readonly ContentEntry<Meta>[] = []): MutableSource {
  let entries = [...initial];
  let reads = 0;

  return {
    source: {
      id: "mutable",
      entries: () => {
        reads += 1;
        return entries;
      }
    },
    set: next => {
      entries = [...next];
    },
    add: (...added) => {
      entries.push(...added);
    },
    remove: (...paths) => {
      const removed = new Set(paths);
      entries = entries.filter(entry => !removed.has(entry.path));
    },
    replace: entry => {
      entries = [...entries.filter(existing => existing.path !== entry.path), entry];
    },
    get reads() {
      return reads;
    }
  };
}
