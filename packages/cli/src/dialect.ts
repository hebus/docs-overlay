/**
 * Which framework's conventions an overlay tree is read with.
 *
 * The engine takes `slugify` and `readDirectives` as injected functions, so it is already neutral;
 * what was not neutral was this package, which imported the Docusaurus adapter at module level and so
 * demanded it for `check`, `cut` and `prune` too. A dialect is that wiring, made a value: the
 * framework-specific decisions involved in reading a tree off disk, gathered in one object the caller
 * chooses instead of a dependency the bundle carries.
 *
 * The generic dialect is a real answer, not a fallback. That distinction is load-bearing — see
 * `resolveDialect`.
 */

import { createSlugify, normaliseDirectives, type OverlayDirectives, type Slug, type SlugifyFn } from "docs-overlay";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Metadata this package attaches to entries. Structurally a superset of the adapter's
 * `DocusaurusMeta`, and declared here rather than imported: even a type-only import would put
 * `docs-overlay-docusaurus` in this package's `.d.ts` files, and a Fumadocs consumer without the
 * adapter installed would then fail to typecheck. TypeScript is structural, so the two interchange.
 */
export interface SiteMeta {
  /** Parsed frontmatter of a page. */
  readonly frontMatter?: Readonly<Record<string, unknown>> | undefined;
  /** The navigation payload, when the entry is a version's navigation file. */
  readonly sidebars?: unknown;
}

export type DialectName = "docusaurus" | "generic";

/** A dialect's navigation file, when it has one. Grouped so a dialect without one has no parser to ignore. */
export interface DialectNavigation<M> {
  /** File name, looked for once per version folder. */
  readonly file: string;
  /** Parses it into metadata. May throw: `readSite` turns the failure into a diagnostic. */
  readonly parse: (text: string) => M;
}

export interface SiteDialect<M = SiteMeta> {
  readonly name: DialectName;
  /** `undefined` when the dialect reads no navigation file, which is not the same as reading an empty one. */
  readonly navigation: DialectNavigation<M> | undefined;
  readonly slugify: SlugifyFn;
  /** The slug a page declares in its frontmatter, which wins over the path. */
  readonly declaredSlug: (pathWithinVersion: string, frontMatterSlug: unknown) => Slug | undefined;
  /**
   * Directives carried by metadata already read.
   *
   * Takes the metadata and not a `ContentEntry` because `prune` needs it on a `ResolvedPage`, which
   * exposes `meta` and not the directives the engine derived from it.
   */
  readonly directivesOf: (meta: M) => OverlayDirectives | undefined;
}

/**
 * Navigation files that identify a dialect other than the one in use.
 *
 * Deliberately just this one. Fumadocs names its navigation `meta.json`, which is a perfectly
 * ordinary file to find in a tree read generically — listing it would fail every Fumadocs site.
 * `sidebars.json` in a version folder, by contrast, means Docusaurus and nothing else.
 */
export const FOREIGN_META_FILES: Readonly<Record<string, DialectName>> = Object.freeze({ "sidebars.json": "docusaurus" });

/** A navigation file found in a tree read with a different dialect. */
export interface ForeignMetaFile {
  readonly path: string;
  readonly dialect: DialectName;
}

/**
 * Config file names that identify a Docusaurus site.
 *
 * One list, used both to find the site root and to pick the dialect, because two lists would
 * eventually disagree — and the day they disagree, the tool reads a Docusaurus tree with the wrong
 * slug rules.
 */
const DOCUSAURUS_CONFIGS = ["docusaurus.config.js", "docusaurus.config.ts", "docusaurus.config.mjs", "docusaurus.config.cjs"];

export const hasDocusaurusConfig = (directory: string): boolean => DOCUSAURUS_CONFIGS.some(name => existsSync(join(directory, name)));

const genericSlugify = createSlugify();

/** Reads a frontmatter `slug`: absolute when it starts with `/`, otherwise relative to the file's own directory. */
function declaredSlugOf(slugify: SlugifyFn, pathWithinVersion: string, frontMatterSlug: unknown): Slug | undefined {
  if (typeof frontMatterSlug !== "string" || frontMatterSlug.trim() === "") return undefined;
  const value = frontMatterSlug.trim();
  const segments = value.split("/").filter(segment => segment !== "");

  if (value.startsWith("/")) return segments;
  return [...slugify(pathWithinVersion).slice(0, -1), ...segments];
}

/**
 * Frontmatter and the engine's own path rules, and no navigation file at all.
 *
 * Correct for any tree whose slugs are its paths — what a framework routing off the filesystem does —
 * and correct *by definition* for a tree that is not Docusaurus. It is wrong for one that is, which
 * is why nothing selects it as a consolation prize.
 */
export const genericDialect: SiteDialect = {
  name: "generic",
  navigation: undefined,
  slugify: genericSlugify,
  declaredSlug: (path, frontMatterSlug) => declaredSlugOf(genericSlugify, path, frontMatterSlug),
  directivesOf: meta => normaliseDirectives(meta.frontMatter?.["overlay"])
};

/**
 * Not exported, and that is deliberate: its parameter type is the adapter's own module type, so
 * exporting it would name `docs-overlay-docusaurus` in this package's emitted declarations — the one
 * thing that would make the optional peer dependency mandatory again, for typechecking if not at run
 * time. `tsc` emits declarations only for exported bindings, so keeping this local keeps the `.d.ts`
 * files free of it.
 */
function docusaurusDialectFrom(adapter: typeof import("docs-overlay-docusaurus")): SiteDialect {
  // One options object for both, or the slug a page declares and the slug derived from its path would
  // disagree about number prefixes.
  const slugify = adapter.docusaurusSlugify();

  return {
    name: "docusaurus",
    navigation: { file: "sidebars.json", parse: text => ({ sidebars: JSON.parse(text) as unknown }) },
    slugify,
    declaredSlug: (path, frontMatterSlug) => adapter.declaredSlug(path, frontMatterSlug),
    // What `readDocusaurusDirectives()` does, expressed against metadata instead of an entry.
    directivesOf: meta => normaliseDirectives(meta.frontMatter?.["overlay"])
  };
}

export interface ResolvedDialect {
  readonly dialect: SiteDialect;
  /** Why this dialect, in the words a command prints. Shown so a wrong guess is visible, not silent. */
  readonly reason: string;
  /**
   * `true` when the caller named it rather than letting detection decide.
   *
   * The difference is what `dialectMismatch` is for: a guess that contradicts the tree is a mistake worth
   * refusing, while the same reading asked for by name is a decision already taken.
   */
  readonly requested: boolean;
}

/**
 * Picks a dialect, and says why.
 *
 * **Never falls back.** A Docusaurus tree read generically gets wrong slugs in silence: the adapter
 * reimplements the plugin's rules because the engine's `createSlugify` knows one of the three
 * category-index conventions and no number prefixes, so every directive would aim at a URL that does
 * not exist — with nothing to report, both sides being internally consistent. So a Docusaurus site
 * whose adapter is missing is an error, and the generic dialect is only ever an explicit answer:
 * asked for by name, or the honest reading of a tree with no Docusaurus config above it.
 */
export async function resolveDialect(siteDir: string, requested?: DialectName | undefined): Promise<ResolvedDialect> {
  if (requested === "generic") return { dialect: genericDialect, reason: "--dialect generic", requested: true };

  if (requested !== "docusaurus" && !hasDocusaurusConfig(siteDir)) {
    return { dialect: genericDialect, reason: `no docusaurus.config.* in ${siteDir}`, requested: false };
  }

  const adapter = await import("docs-overlay-docusaurus").catch(() => undefined);
  if (adapter === undefined) {
    throw new Error(
      "This tree needs the Docusaurus adapter, and it is not installed.\n\n" +
        "  npm install docs-overlay-docusaurus\n\n" +
        `${requested === "docusaurus" ? "You asked for --dialect docusaurus" : `A Docusaurus config sits in ${siteDir}`}, and reading a Docusaurus tree with the\n` +
        "generic dialect would derive different slugs — silently, since nothing would look wrong. Pass\n" +
        "--dialect generic to confirm you want the generic rules anyway.\n"
    );
  }

  return {
    dialect: docusaurusDialectFrom(adapter),
    reason: requested === "docusaurus" ? "--dialect docusaurus" : `docusaurus.config.* in ${siteDir}`,
    requested: requested === "docusaurus"
  };
}

/**
 * Refuses a tree that belongs to a dialect other than the one reading it.
 *
 * The config-file test can miss — `--site-dir` pointed elsewhere, the command run from outside the
 * site, a config named something not on the list — and a miss is silent, which is what makes a second
 * test on evidence from the tree itself worth having. Returns the message to print, or `undefined`
 * when there is nothing to say.
 *
 * `requested` is why this refuses a guess and not a choice: the message it prints offers `--dialect` as
 * the way through, so honouring that flag is what keeps the advice true. Someone who has read the
 * warning and named the dialect anyway has answered the question this asks.
 */
export function dialectMismatch(foreignMetaFiles: readonly ForeignMetaFile[], dialect: SiteDialect, requested = false): string | undefined {
  const foreign = foreignMetaFiles[0];
  if (foreign === undefined || requested) return undefined;

  return (
    `${foreign.path} is a ${foreign.dialect} navigation file, but this tree is being read with the ${dialect.name} dialect.\n\n` +
    "The two derive slugs differently, so every overlay directive here would aim at a URL that does not\n" +
    "exist — and nothing would report it, because both sides would look internally consistent.\n\n" +
    `  --dialect ${foreign.dialect}  reads it the way it was authored\n` +
    `  --dialect ${dialect.name}${" ".repeat(Math.max(0, foreign.dialect.length - dialect.name.length))}  confirms these are the rules you want\n`
  );
}
