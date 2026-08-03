import { describe, expect, it } from "vitest";

import type { SlugKey } from "../models/ids.js";
import { collectDiagnostics } from "../testing/diagnostics.js";
import { collapseIndirections } from "./collapse.js";
import type { IndexEntry } from "./index-entry.js";

/**
 * These entries are built by hand rather than folded from fixtures on purpose: the overlay rules
 * make a redirect cycle unreachable through directives (see `overlay-directives.test.ts`), so the
 * guard is only exercisable at this level. It still has to hold, because a custom `readDirectives`
 * can produce anything.
 */
type Entries = Map<SlugKey, IndexEntry<unknown>>;

const pageEntry = (path: string, slug: readonly string[]): IndexEntry<unknown> => ({
  kind: "page",
  hops: 0,
  source: { definedIn: "1.0.0", path, slug },
  meta: {},
  origin: undefined,
  directives: {}
});

const redirectEntry = (to: SlugKey): IndexEntry<unknown> => ({
  kind: "redirect",
  to,
  permanent: true,
  reason: "renamed",
  definedIn: "1.0.0",
  declaredBy: "1.0.0/declaring.md"
});

const deletedEntry = (options: { deletedIn: string; lastAvailable?: { version: string; slug: string[] }; replacedBy?: SlugKey }): IndexEntry<unknown> => ({
  kind: "deleted",
  deletedIn: options.deletedIn,
  lastAvailable: options.lastAvailable,
  replacedBy: options.replacedBy,
  declaredBy: `${options.deletedIn}/tombstone.md`
});

describe("collapseIndirections", () => {
  it("points a chain straight at the page and marks it chained", () => {
    const entries: Entries = new Map([
      ["a", redirectEntry("b")],
      ["b", redirectEntry("c")],
      ["c", pageEntry("1.0.0/c.md", ["c"])]
    ]);

    collapseIndirections(entries, "1.0.0");

    const a = entries.get("a");
    expect(a?.kind).toBe("redirect");
    if (a?.kind !== "redirect") return;
    expect(a.to).toBe("c");
    expect(a.reason).toBe("chained");
  });

  it("keeps the original reason for a single hop", () => {
    const entries: Entries = new Map([
      ["a", redirectEntry("b")],
      ["b", pageEntry("1.0.0/b.md", ["b"])]
    ]);

    collapseIndirections(entries, "1.0.0");
    const a = entries.get("a");
    if (a?.kind !== "redirect") throw new Error("expected redirect");
    expect(a.reason).toBe("renamed");
  });

  it("removes every slug in a cycle and reports the cycle once", () => {
    const diagnostics = collectDiagnostics();
    const entries: Entries = new Map([
      ["a", redirectEntry("b")],
      ["b", redirectEntry("a")]
    ]);

    collapseIndirections(entries, "2.0.0", diagnostics.sink);

    expect(entries.size).toBe(0);
    // One diagnostic naming the whole cycle, not one per member claiming a missing target.
    expect(diagnostics.codes()).toEqual(["redirect-cycle"]);
    expect(diagnostics.all[0]?.version).toBe("2.0.0");
    expect(diagnostics.all[0]?.message).toContain("a -> b -> a");
  });

  it("keeps a page that a cycle happened to pass through", () => {
    const diagnostics = collectDiagnostics();
    const page = pageEntry("1.0.0/keep.md", ["keep"]);
    const entries: Entries = new Map([
      ["a", redirectEntry("b")],
      ["b", redirectEntry("a")],
      ["keep", page]
    ]);

    collapseIndirections(entries, "2.0.0", diagnostics.sink);

    expect(entries.get("keep")).toBe(page);
    expect([...entries.keys()]).toEqual(["keep"]);
  });

  it("survives a redirect pointing at itself", () => {
    const diagnostics = collectDiagnostics();
    const entries: Entries = new Map([["a", redirectEntry("a")]]);

    collapseIndirections(entries, "1.0.0", diagnostics.sink);

    expect(entries.has("a")).toBe(false);
    expect(diagnostics.codes()).toEqual(["redirect-cycle"]);
  });

  it("drops a redirect whose target does not exist", () => {
    const diagnostics = collectDiagnostics();
    const entries: Entries = new Map([["a", redirectEntry("ghost")]]);

    collapseIndirections(entries, "1.0.0", diagnostics.sink);

    expect(entries.has("a")).toBe(false);
    expect(diagnostics.codes()).toEqual(["redirect-target-missing"]);
  });

  it("resolves an alias through a redirect to the real page", () => {
    const entries: Entries = new Map([
      ["shortcut", { kind: "alias", target: "a", definedIn: "1.0.0", declaredBy: "1.0.0/api.md" }],
      ["a", redirectEntry("b")],
      ["b", pageEntry("1.0.0/b.md", ["b"])]
    ]);

    collapseIndirections(entries, "1.0.0");

    const alias = entries.get("shortcut");
    if (alias?.kind !== "alias") throw new Error("expected alias");
    expect(alias.target).toBe("b");
  });

  it("turns a redirect onto a removed page into the removal itself", () => {
    const entries: Entries = new Map([
      ["old", redirectEntry("new")],
      ["new", deletedEntry({ deletedIn: "3.0.0", lastAvailable: { version: "2.0.0", slug: ["new"] } })]
    ]);

    collapseIndirections(entries, "3.0.0");

    const old = entries.get("old");
    expect(old?.kind).toBe("deleted");
    if (old?.kind !== "deleted") return;
    expect(old.lastAvailable).toEqual({ version: "2.0.0", slug: ["new"] });
  });

  it("stops rather than looping when two tombstones replace each other", () => {
    const entries: Entries = new Map([
      ["x", redirectEntry("a")],
      ["a", deletedEntry({ deletedIn: "3.0.0", replacedBy: "b" })],
      ["b", deletedEntry({ deletedIn: "3.0.0", replacedBy: "a" })]
    ]);

    collapseIndirections(entries, "3.0.0");
    expect(entries.get("x")?.kind).toBe("deleted");
  });

  it("leaves pages and tombstones alone", () => {
    const page = pageEntry("1.0.0/a.md", ["a"]);
    const entries: Entries = new Map([["a", page]]);

    collapseIndirections(entries, "1.0.0");
    expect(entries.get("a")).toBe(page);
  });
});
