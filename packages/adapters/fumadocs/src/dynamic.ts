import type { SourcePath } from "@docs-overlay/core";
import type { DynamicSource, StaticSource } from "fumadocs-core/source";

import { overlaySource, type OverlayFumadocsOptions, type OverlaySource } from "./overlay-source.js";

export interface OverlayDynamicOptions<S extends StaticSource = StaticSource> extends Omit<OverlayFumadocsOptions<S>, "source"> {
  /** Re-read on every rebuild, so a file the watcher touched is picked up. */
  readonly source: () => S;
}

export interface OverlayDynamicSource {
  /** Pass to `dynamicLoader({ source })`. */
  readonly source: DynamicSource;
  /**
   * The current projection. Replaced on every {@link invalidate}, so read it through this getter
   * rather than holding on to it.
   */
  readonly current: OverlaySource;
  /**
   * Re-reads the content and returns the versions whose routes changed, so a dev server can refresh
   * exactly those and nothing else. Pair it with `dynamicLoader().revalidate()`.
   */
  invalidate(paths?: Iterable<SourcePath>): { readonly versions: readonly string[]; readonly structural: boolean };
}

/**
 * Development-time variant: rebuilds the projection on demand instead of once at module load.
 *
 * The impact of a change is measured against the state being replaced — for a deleted file, asking
 * afterwards returns the new, empty answer and the dev server never learns which routes went stale.
 */
export function overlayDynamicSource<S extends StaticSource = StaticSource>(options: OverlayDynamicOptions<S>): OverlayDynamicSource {
  // The factory is handed straight through, so the engine keeps re-reading it.
  let projection = overlaySource<S>(options);

  const rebuild = (): void => {
    projection = overlaySource<S>(options);
  };

  return {
    source: {
      files: () => projection.source.files
    },
    get current() {
      return projection;
    },
    invalidate(paths) {
      const impact = projection.overlay.invalidate(paths);
      rebuild();
      return { versions: impact.versions, structural: impact.structural };
    }
  };
}
