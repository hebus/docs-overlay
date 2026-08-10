/**
 * Output. Deliberately plain: this runs in `prebuild`, where a spinner between two build logs helps
 * nobody, and where a machine may be reading stderr.
 */

import type { Diagnostic } from "docs-overlay";

export const say = (message: string): void => {
  console.log(message);
};

/** Errors go to stderr so `--json` on stdout stays parseable even when something goes wrong. */
export const fail = (message: string): void => {
  console.error(`\ndocs-overlay: ${message}`);
};

export const hasErrors = (diagnostics: readonly Diagnostic[]): boolean => diagnostics.some(diagnostic => diagnostic.severity === "error");

export function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  if (diagnostics.length === 0) return "No problems found.";

  const errors = diagnostics.filter(diagnostic => diagnostic.severity === "error");
  const warnings = diagnostics.filter(diagnostic => diagnostic.severity === "warning");
  const lines: string[] = [];

  // Errors first: a build is about to fail on one of them, and burying it under warnings wastes the
  // reader's time.
  for (const diagnostic of [...errors, ...warnings]) {
    const where = [diagnostic.version, diagnostic.path ?? diagnostic.slug?.join("/")].filter(Boolean).join(" ");
    lines.push(`${diagnostic.severity.padEnd(7)} ${diagnostic.code.padEnd(26)} ${where === "" ? "" : `${where}  `}${diagnostic.message}`);
  }

  lines.push("", `${errors.length} error(s), ${warnings.length} warning(s).`);
  return lines.join("\n");
}
