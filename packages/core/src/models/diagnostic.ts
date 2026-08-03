import type { Slug, SourcePath, VersionId } from "./ids.js";

export type DiagnosticSeverity = "error" | "warning";

export type DiagnosticCode =
  /** A top-level folder is neither valid semver nor a declared channel. Folder ignored. */
  | "unknown-version-folder"
  /** Two distinct version ids compare as equal, so their relative order is arbitrary. */
  | "ambiguous-version-order"
  /** `inheritsFrom` points at a version that does not exist. Override ignored. */
  | "inherits-from-unknown"
  /** `inheritsFrom` forms a cycle. The chain is cut at the offending version. */
  | "inheritance-cycle"
  /** Two files in the same version resolve to the same slug. */
  | "duplicate-slug"
  /** A tombstone marks a page that nothing in the inheritance chain provides. */
  | "tombstone-without-target"
  /** `renamedFrom` targets a slug the same version also defines as a real file. */
  | "rename-collision"
  /** `aliases` targets a slug the same version also defines as a real file. */
  | "alias-collision"
  /** A redirect chain loops. Every entry in the cycle resolves to `missing`. */
  | "redirect-cycle"
  /** A redirect points at a slug nothing provides. */
  | "redirect-target-missing"
  /** An inherited navigation list was completed so newly added pages stay visible. */
  | "meta-pages-completed"
  /** A page exists but no navigation tree reaches it. */
  | "orphan-page";

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly version?: VersionId | undefined;
  readonly path?: SourcePath | undefined;
  readonly slug?: Slug | undefined;
}

export type DiagnosticSink = (diagnostic: Diagnostic) => void;
