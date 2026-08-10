import { describe, expect, it } from "vitest";

import type { Snapshot, SnapshotFile, SnapshotStep } from "./snapshot-plan.js";
import { planSnapshots } from "./snapshot-plan.js";

/**
 * Fixtures are TypeScript factories, never files on disk. The bodies below are small, but each shape
 * is one the measured Docusaurus corpus actually produced — the cases are named after it, so a failure
 * says which real situation regressed.
 */
const file = (path: string, body: string, title?: string): SnapshotFile => ({
  path,
  // Byte identity is what decides pruning, and the caller supplies it. Using the body itself as the
  // digest keeps the fixtures readable and preserves the property that matters: equal bodies prune.
  digest: `sha:${body}`,
  read: () => body,
  ...(title === undefined ? {} : { title })
});

const snapshot = (version: string, ...files: readonly SnapshotFile[]): Snapshot => ({ version, files });

const lines = (...values: readonly string[]): string => `${values.join("\n")}\n`;

const stepsOf = (plan: { steps: readonly SnapshotStep[] }, kind: SnapshotStep["kind"]): readonly SnapshotStep[] =>
  plan.steps.filter(step => step.kind === kind);

describe("planSnapshots", () => {
  it("keeps the oldest snapshot whole and prunes what a later one repeats verbatim", () => {
    const shared = lines("# Shared", "unchanged prose");
    const plan = planSnapshots([
      snapshot("1.0.0", file("guide/a.md", shared), file("guide/b.md", lines("# B", "old"))),
      snapshot("2.0.0", file("guide/a.md", shared), file("guide/b.md", lines("# B", "new")))
    ]);

    expect(plan.stats.base).toBe(2);
    expect(stepsOf(plan, "prune")).toEqual([{ kind: "prune", version: "2.0.0", path: "guide/a.md", inheritedFrom: "1.0.0" }]);
    expect(stepsOf(plan, "override")).toEqual([{ kind: "override", version: "2.0.0", path: "guide/b.md", inheritedFrom: "1.0.0" }]);
    expect(plan.stats.filesAfter).toBe(3);
    expect(plan.stats.filesBefore).toBe(4);
  });

  it("measures a version against the folded chain, not against the folder just before it", () => {
    const body = lines("# A", "written once in 1.0.0");
    const plan = planSnapshots([snapshot("1.0.0", file("a.md", body)), snapshot("2.0.0", file("a.md", body)), snapshot("3.0.0", file("a.md", body))]);

    // Without folding, 3.0.0 would be compared against an empty 2.0.0 and read as an addition.
    expect(plan.stats.additions).toBe(0);
    expect(plan.stats.pruned).toBe(2);
  });

  it("treats a changed extension as an override, because the slug is what identifies a page", () => {
    // atomic/api/suggest.mdx became atomic/api/suggest.md between 11.13.0 and 11.14.0. Keyed on
    // filenames this is a deletion plus an addition, and the counts still add up — which is what makes
    // it dangerous.
    const plan = planSnapshots([
      snapshot("1.0.0", file("api/suggest.mdx", lines("# Suggest", "old"))),
      snapshot("2.0.0", file("api/suggest.md", lines("# Suggest", "new")))
    ]);

    expect(plan.stats.overrides).toBe(1);
    expect(plan.stats.additions).toBe(0);
    expect(plan.stats.tombstones).toBe(0);
    expect(plan.questions).toHaveLength(0);
  });

  it("accepts a rename when name and body agree", () => {
    const body = lines("# Filters", "how filters work", "step one", "step two");
    const plan = planSnapshots([
      snapshot("1.0.0", file("config/filters.mdx", body, "Filters")),
      snapshot("2.0.0", file("config/customization/filters.mdx", body, "Filters"))
    ]);

    expect(stepsOf(plan, "rename")).toEqual([{ kind: "rename", version: "2.0.0", path: "config/customization/filters.mdx", from: ["config/filters"] }]);
    expect(plan.questions).toHaveLength(0);
  });

  it("accepts a rename on a line-identical body even when the filename shares nothing", () => {
    // mint/configurations/customization -> customization/custom-json-files: 397 lines on both sides,
    // body identical, only the frontmatter changed. The weighted score lands at 0.700, below accept,
    // purely because the stem changed.
    const body = lines("# Customization", "configuration lives in JSON files", "one per area", "edited in admin");
    const plan = planSnapshots([
      snapshot("1.0.0", file("config/customization.mdx", body, "Via Sinequa Admin")),
      snapshot(
        "2.0.0",
        file("config/customization/custom-json-files.mdx", body, "Custom Json files"),
        file("config/customization/other.mdx", lines("# Other", "nothing alike"), "Other")
      )
    ]);

    expect(stepsOf(plan, "rename")).toEqual([
      { kind: "rename", version: "2.0.0", path: "config/customization/custom-json-files.mdx", from: ["config/customization"] }
    ]);
    expect(plan.questions).toHaveLength(0);
  });

  it("refuses to call it a rename when two candidates share the identical body", () => {
    const body = lines("# Same", "identical everywhere");
    const plan = planSnapshots([
      snapshot("1.0.0", file("old.md", body, "Same")),
      snapshot("2.0.0", file("copy-a.md", body, "Same"), file("copy-b.md", body, "Same"))
    ]);

    // A duplicated page is not a move, and picking one of the two copies would be a coin toss.
    expect(plan.questions).toHaveLength(1);
    expect(stepsOf(plan, "rename")).toHaveLength(0);
  });

  it("never proposes a rename onto a slug the parent already served", () => {
    // atomic/changelog vanished while `changelog` kept existing. Same stem, same title, 1% shared body.
    // A name-driven heuristic proposes it confidently and claims a move that never happened.
    const plan = planSnapshots([
      snapshot(
        "1.0.0",
        file("atomic/changelog.md", lines("# Recents Changes", "a short stub"), "Recents Changes"),
        file("changelog.md", lines("# Recents Changes", "the long project changelog", "many entries"), "Recents Changes")
      ),
      snapshot("2.0.0", file("changelog.md", lines("# Recents Changes", "the long project changelog", "more entries"), "Recents Changes"))
    ]);

    expect(stepsOf(plan, "rename")).toHaveLength(0);
    expect(plan.questions).toHaveLength(1);

    const question = plan.questions[0]!;
    expect(question.slug).toEqual(["atomic", "changelog"]);
    const ineligible = question.candidates.filter(candidate => candidate.ineligible !== undefined);
    expect(ineligible.map(candidate => candidate.slug.join("/"))).toContain("changelog");
    // It is still worth offering as a destination — the question is `replacedBy`, not `renamedFrom`.
    expect(question.suggestions).toContain("changelog");
  });

  it("tombstones silently when nothing resembles the page, including an empty one", () => {
    // mint/features/search/components/record-card.mdx is 0 bytes on the real corpus.
    const plan = planSnapshots([
      snapshot("1.0.0", file("features/record-card.mdx", ""), file("features/keep.md", lines("# Keep", "kept"))),
      snapshot("2.0.0", file("features/keep.md", lines("# Keep", "kept")), file("features/unrelated.md", lines("# Unrelated", "wholly different")))
    ]);

    expect(plan.questions).toHaveLength(0);
    expect(stepsOf(plan, "tombstone")).toEqual([
      {
        kind: "tombstone",
        version: "2.0.0",
        slug: ["features", "record-card"],
        path: "features/record-card.mdx",
        recursive: false,
        lastAvailable: "1.0.0"
      }
    ]);
  });

  it("cites the version that last served the page, not the one before it", () => {
    const body = lines("# Doomed", "still here");
    const plan = planSnapshots([
      snapshot("1.0.0", file("doomed.md", body)),
      snapshot("2.0.0", file("doomed.md", lines("# Doomed", "revised in 2.0.0"))),
      snapshot("3.0.0", file("other.md", lines("# Other", "unrelated")))
    ]);

    const tombstone = stepsOf(plan, "tombstone")[0]!;
    expect(tombstone).toMatchObject({ version: "3.0.0", lastAvailable: "2.0.0" });
  });

  it("collapses a directory that loses every page and gains none", () => {
    const plan = planSnapshots([
      snapshot("1.0.0", file("legacy/one.md", lines("# One", "a")), file("legacy/two.md", lines("# Two", "b")), file("kept.md", lines("# Kept", "c"))),
      snapshot("2.0.0", file("kept.md", lines("# Kept", "c")))
    ]);

    const tombstones = stepsOf(plan, "tombstone");
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0]).toMatchObject({ recursive: true });
  });

  it("does not collapse a directory that also gained a page", () => {
    // mint/features/search/ lost three pages and gained data-flow. Recursing there would tombstone a
    // page that is very much alive.
    const plan = planSnapshots([
      snapshot("1.0.0", file("search/one.md", lines("# One", "a")), file("search/two.md", lines("# Two", "b"))),
      snapshot("2.0.0", file("search/data-flow.md", lines("# Data flow", "wholly new material")))
    ]);

    const tombstones = stepsOf(plan, "tombstone");
    expect(tombstones).toHaveLength(2);
    expect(tombstones.every(step => step.kind === "tombstone" && !step.recursive)).toBe(true);
  });

  it("lets a recorded decision override the heuristic, so a plan replays identically", () => {
    const plan = planSnapshots(
      [
        snapshot("1.0.0", file("old.md", lines("# Old", "a page"), "Old")),
        snapshot("2.0.0", file("new.md", lines("# New", "unrecognisably different"), "New"))
      ],
      { decisions: [{ kind: "rename", version: "2.0.0", slug: "old", to: "new" }] }
    );

    expect(stepsOf(plan, "rename")).toEqual([{ kind: "rename", version: "2.0.0", path: "new.md", from: ["old"] }]);
    expect(plan.questions).toHaveLength(0);
  });

  it("records a decision pointing at a slug the version does not provide, rather than acting on it", () => {
    const plan = planSnapshots([snapshot("1.0.0", file("old.md", lines("# Old", "a"))), snapshot("2.0.0", file("new.md", lines("# New", "b")))], {
      decisions: [{ kind: "rename", version: "2.0.0", slug: "old", to: "typo" }]
    });

    expect(plan.diagnostics.map(diagnostic => diagnostic.code)).toContain("redirect-target-missing");
    expect(stepsOf(plan, "rename")).toHaveLength(0);
    expect(stepsOf(plan, "tombstone")).toHaveLength(1);
  });

  it("reports two files claiming one slug instead of silently dropping one", () => {
    const plan = planSnapshots([snapshot("1.0.0", file("a.md", lines("# A", "x")), file("a.mdx", lines("# A", "y")))]);

    expect(plan.diagnostics).toHaveLength(1);
    expect(plan.diagnostics[0]).toMatchObject({ code: "duplicate-slug", severity: "error", version: "1.0.0" });
  });

  it("never throws on an empty corpus", () => {
    const plan = planSnapshots([]);
    expect(plan.steps).toEqual([]);
    expect(plan.stats.filesBefore).toBe(0);
  });

  it("keeps every file when pruning is off", () => {
    const body = lines("# A", "same");
    const plan = planSnapshots([snapshot("1.0.0", file("a.md", body)), snapshot("2.0.0", file("a.md", body))], { prune: false });

    expect(stepsOf(plan, "prune")).toHaveLength(0);
    expect(stepsOf(plan, "pin")).toHaveLength(1);
    expect(plan.stats.filesAfter).toBe(2);
  });
});
