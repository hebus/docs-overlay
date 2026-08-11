/**
 * Reading an overlay tree off disk and handing it to the engine.
 *
 * Small, and load-bearing. Three details here decide whether every directive in the corpus lands on the
 * page its author meant, and all three fail silently when they are wrong.
 *
 * All three are framework-specific, and all three arrive as a {@link SiteDialect} rather than as an
 * import: that is what lets `check`, `cut` and `prune` run on a machine where no adapter is installed.
 * This module used to import the Docusaurus one at the top, which — through a single bundle — made it a
 * hard requirement of every command.
 */

import { createOverlay, type ContentEntry, type Diagnostic, type Overlay } from "docs-overlay";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { FOREIGN_META_FILES, type ForeignMetaFile, type SiteDialect, type SiteMeta } from "./dialect.js";
import { toPosix, walk } from "./io.js";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;
const PAGE = /\.mdx?$/i;

export interface SiteSource<M = SiteMeta> {
  readonly overlay: Overlay<M>;
  readonly entries: readonly ContentEntry<M>[];
  /** Absolute path per entry path, so a caller can copy bytes. */
  readonly origins: ReadonlyMap<string, string>;
  readonly diagnostics: readonly Diagnostic[];
  /**
   * Navigation files belonging to another dialect, in the order found.
   *
   * Reported rather than refused, because this is a library: the tree is still read, and whether an
   * odd file is fatal is the command's call. `dialectMismatch()` turns it into the message they print.
   */
  readonly foreignMetaFiles: readonly ForeignMetaFile[];
}

export interface ReadSiteOptions<M extends SiteMeta = SiteMeta> {
  readonly contentDir: string;
  readonly channels?: readonly string[] | undefined;
  /**
   * Conventions to read the tree with: how a path becomes a slug, and which navigation file counts.
   *
   * Required, with no default, and that is the point. The two dialects derive different slugs, so a
   * caller who omits it is not asking for a sensible default — they are leaving the single decision that
   * determines whether every directive in the corpus lands on the right page. `genericDialect` is right
   * there for anyone who wants the neutral rules; asking for them is a sentence of code, and getting
   * them by accident used to be a silent wrong answer.
   */
  readonly dialect: SiteDialect<M>;
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

export function readSite<M extends SiteMeta = SiteMeta>(options: ReadSiteOptions<M>): SiteSource<M> {
  const diagnostics: Diagnostic[] = [];
  const report = (diagnostic: Diagnostic): void => {
    diagnostics.push(diagnostic);
    options.onDiagnostic?.(diagnostic);
  };

  // The two casts below are one fact: this is the factory that *decides* what an entry's metadata is,
  // and `M` is the caller's name for the shape it produces. TypeScript cannot prove an object literal
  // satisfies an unresolved type parameter, so the assertion sits here, in the one place that knows the
  // answer, rather than at every call site.
  const dialect = options.dialect;
  const navigation = dialect.navigation;
  const entries: ContentEntry<M>[] = [];
  const origins = new Map<string, string>();
  const foreignMetaFiles: ForeignMetaFile[] = [];

  const versions = existsSync(options.contentDir) ? readdirSync(options.contentDir).filter(name => statSync(join(options.contentDir, name)).isDirectory()) : [];

  for (const version of versions.sort()) {
    const versionDir = join(options.contentDir, version);

    for (const rest of walk(versionDir)) {
      const absolute = join(versionDir, rest);
      const path = `${version}/${rest}`;

      if (navigation !== undefined && rest === navigation.file) {
        const text = readTextOf(absolute);
        try {
          entries.push({ path, kind: "meta", meta: navigation.parse(text), origin: absolute });
          origins.set(path, absolute);
        } catch (error) {
          report({
            code: "meta-pages-completed",
            severity: "error",
            message: `${path} is not a readable ${navigation.file}: ${error instanceof Error ? error.message : String(error)}`,
            version,
            path
          });
        }
        continue;
      }

      // A navigation file this dialect does not read is the one piece of evidence that the tree may
      // belong to another one — worth collecting before it is carried along as an ordinary file, since
      // the slug rules differing is not something anything downstream would notice.
      const foreign = FOREIGN_META_FILES[rest];
      if (foreign !== undefined && foreign !== dialect.name) foreignMetaFiles.push({ path, dialect: foreign });

      // Infrastructure, not content. `.gitkeep` is the one that matters: an emptied channel needs it to
      // exist in git at all, and carrying it would make `.gitkeep` a slug the overlay serves.
      if (rest.split("/").some(segment => segment.startsWith("."))) continue;

      // Anything else that is not a page and not the navigation file is carried untouched, so a
      // co-located image inherits, tombstones and renames through the same fold as the pages around it.
      // Nothing is dropped for not being recognised.
      if (!PAGE.test(rest)) {
        entries.push({ path, kind: "page", meta: {} as M, slug: toPosix(rest).split("/"), origin: absolute });
        origins.set(path, absolute);
        continue;
      }

      const frontMatter = readFrontMatter(readTextOf(absolute), message =>
        report({ code: "duplicate-slug", severity: "error", message: `${path}: frontmatter is not valid YAML — ${message}`, version, path })
      );

      // Assigned explicitly, always. A page declaring `slug: /faq` is routed there, and letting the
      // engine derive `how-to/faq` instead would express every directive against a URL that does not
      // exist — with nothing to report, because both sides look internally consistent.
      const slug = dialect.declaredSlug(rest, frontMatter["slug"]) ?? dialect.slugify(rest);
      entries.push({ path, kind: "page", meta: { frontMatter } as M, slug, origin: absolute });
      origins.set(path, absolute);
    }
  }

  const overlay = createOverlay<M>({
    source: entries,
    ...(options.channels === undefined ? {} : { channels: options.channels }),
    slugify: dialect.slugify,
    readDirectives: entry => dialect.directivesOf(entry.meta),
    onDiagnostic: report
  });

  return { overlay, entries, origins, diagnostics, foreignMetaFiles };
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
