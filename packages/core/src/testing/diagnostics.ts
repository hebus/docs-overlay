import type { Diagnostic, DiagnosticCode, DiagnosticSink } from "../models/diagnostic.js";

export interface DiagnosticCollector {
  readonly sink: DiagnosticSink;
  readonly all: readonly Diagnostic[];
  codes(): DiagnosticCode[];
}

/** Test helper: gathers diagnostics so a suite can assert on codes instead of on thrown errors. */
export function collectDiagnostics(): DiagnosticCollector {
  const all: Diagnostic[] = [];
  return {
    sink: diagnostic => all.push(diagnostic),
    all,
    codes: () => all.map(diagnostic => diagnostic.code)
  };
}
