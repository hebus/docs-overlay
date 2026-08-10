/**
 * Reading a Docusaurus overlay tree off disk and handing it to the engine.
 *
 * Small, and load-bearing. Three details here decide whether every directive in the corpus lands on the
 * page its author meant, and all three fail silently when they are wrong.
 */

import { createOverlay, type ContentEntry, type Diagnostic, type Overlay } from "docs-overlay";
import { declaredSlug, docusaurusSlugify, readDocusaurusDirectives, type DocusaurusMeta } from "docs-overlay-docusaurus";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { toPosix, walk } from "./io.js";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;
const PAGE = /\.mdx?$/i;

export interface SiteSource {
  readonly overlay: Overlay<DocusaurusMeta>;
  readonly entries: readonly ContentEntry<DocusaurusMeta>[];
  /** Absolute path per entry path, so a caller can copy bytes. */
  readonly origins: ReadonlyMap<string, string>;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ReadSiteOptions {
  readonly contentDir: string;
  readonly channels?: readonly string[] | undefined;
  readonly sidebarsFile?: string | undefined;
  readonly onDiagnostic?: ((diagnostic: Diagnostic) => void) | undefined;
}

/** Frontmatter of a page, or `{}` when it has none. Never throws: a malformed block is a diagnostic. */
export function readFrontMatter(text: string, onError?: (message: string) => void): Record<string, unknown> {
  const match = FRONTMATTER.exec(text);
  if (match === null) return {};
  try {
    const parsed = parse(match[1] ?? "") as unknown;
    return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch (error) {
    onError?.(error instanceof Error ? error.message : String(error));
    return {};
  }
}

export function readSite(options: ReadSiteOptions): SiteSource {
  const diagnostics: Diagnostic[] = [];
  const report = (diagnostic: Diagnostic): void => {
    diagnostics.push(diagnostic);
    options.onDiagnostic?.(diagnostic);
  };

  const sidebarsFile = options.sidebarsFile ?? "sidebars.json";
  const slugify = docusaurusSlugify();
  const entries: ContentEntry<DocusaurusMeta>[] = [];
  const origins = new Map<string, string>();

  const versions = existsSync(options.contentDir) ? readdirSync(options.contentDir).filter(name => statSync(join(options.contentDir, name)).isDirectory()) : [];

  for (const version of versions.sort()) {
    const versionDir = join(options.contentDir, version);

    for (const rest of walk(versionDir)) {
      const absolute = join(versionDir, rest);
      const path = `${version}/${rest}`;

      if (rest === sidebarsFile) {
        const text = readTextOf(absolute);
        try {
          entries.push({ path, kind: "meta", meta: { sidebars: JSON.parse(text) as never }, origin: absolute });
          origins.set(path, absolute);
        } catch (error) {
          report({
            code: "meta-pages-completed",
            severity: "error",
            message: `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
            version,
            path
          });
        }
        continue;
      }

      // Infrastructure, not content. `.gitkeep` is the one that matters: an emptied channel needs it to
      // exist in git at all, and carrying it would make `.gitkeep` a slug the overlay serves.
      if (rest.split("/").some(segment => segment.startsWith("."))) continue;

      // Anything else that is not a page and not the navigation file is carried untouched, so a
      // co-located image inherits, tombstones and renames through the same fold as the pages around it.
      // Nothing is dropped for not being recognised.
      if (!PAGE.test(rest)) {
        entries.push({ path, kind: "page", meta: {}, slug: toPosix(rest).split("/"), origin: absolute });
        origins.set(path, absolute);
        continue;
      }

      const frontMatter = readFrontMatter(readTextOf(absolute), message =>
        report({ code: "duplicate-slug", severity: "error", message: `${path}: frontmatter is not valid YAML — ${message}`, version, path })
      );

      // Assigned explicitly, always. A page declaring `slug: /faq` is routed there, and letting the
      // engine derive `how-to/faq` instead would express every directive against a URL that does not
      // exist — with nothing to report, because both sides look internally consistent.
      const slug = declaredSlug(rest, frontMatter["slug"]) ?? slugify(rest);
      entries.push({ path, kind: "page", meta: { frontMatter }, slug, origin: absolute });
      origins.set(path, absolute);
    }
  }

  const overlay = createOverlay<DocusaurusMeta>({
    source: entries,
    ...(options.channels === undefined ? {} : { channels: options.channels }),
    slugify,
    readDirectives: readDocusaurusDirectives(),
    onDiagnostic: report
  });

  return { overlay, entries, origins, diagnostics };
}

/**
 * Reads a file as text, for parsing only.
 *
 * The bytes a page actually ships with are copied straight from disk by the writer and never round-trip
 * through a string, which is what keeps its line endings and encoding exactly as authored. A zero-byte
 * file is answered directly because the corpus has one, and `parse("")` on an empty frontmatter block is
 * a needless round trip.
 */
function readTextOf(path: string): string {
  return statSync(path).size === 0 ? "" : readFileSync(path, "utf8");
}
