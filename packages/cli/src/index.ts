/**
 * Programmatic surface of `docs-overlay-cli`.
 *
 * The commands are exported so a build script can call them without spawning a process, and because a
 * migration is easier to test as a function than as a subprocess. `bin/docs-overlay.mjs` imports
 * `cli.js`, which is the only module that reads `process.argv`.
 */

export { boolFlag, parseArgs, stringFlag, type Parsed } from "./args.js";
export { checkCommand, type CheckArgs } from "./commands/check.js";
export { cutCommand, type CutArgs } from "./commands/cut.js";
export { currentDirOf, materializeCommand, type MaterializeArgs } from "./commands/materialize.js";
export { pruneCommand, type PruneArgs } from "./commands/prune.js";
export {
  dialectMismatch,
  FOREIGN_META_FILES,
  genericDialect,
  hasDocusaurusConfig,
  resolveDialect,
  type DialectName,
  type DialectNavigation,
  type ForeignMetaFile,
  type ResolvedDialect,
  type SiteDialect,
  type SiteMeta
} from "./dialect.js";
export { assertWritable, hashOf, MANIFEST, readManifest, reconcile, SENTINEL, walk, type Manifest, type PlannedFile, type WriteResult } from "./io.js";
export { formatDiagnostics, hasErrors } from "./log.js";
export { readFrontMatter, readSite, type ReadSiteOptions, type SiteSource } from "./site.js";
