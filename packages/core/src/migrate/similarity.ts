/**
 * How alike two documentation pages are, on four independent axes.
 *
 * This exists to answer one question: when a slug disappears from one version and another appears,
 * was that a rename or a deletion plus an addition? Nothing about the answer is framework-specific,
 * and none of it needs a dependency — the measures below are deliberately as plain as the hand-written
 * semver comparator next door.
 */

/** A page reduced to what is worth comparing. */
export interface Comparable {
  /** Body lines, frontmatter removed, trimmed and whitespace-collapsed, blanks dropped. */
  readonly lines: readonly string[];
  /** Frontmatter title, when the caller parsed one. */
  readonly title: string | undefined;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

/**
 * Splits a page into its comparable body and its raw frontmatter block.
 *
 * The frontmatter is excluded from the body on purpose. On the corpus this was built against,
 * `sidebar_class_name` sits on most files and `sidebar_position` on many, so leaving them in pulls
 * every pair of pages towards each other and flattens exactly the differences the score exists to
 * expose. Note that the block is only *located*, never interpreted: parsing YAML is the caller's job.
 */
export function comparable(text: string, title?: string | undefined): Comparable {
  const normalised = text.replace(/\r\n/g, "\n");
  const match = FRONTMATTER.exec(normalised);
  const body = match === null ? normalised : normalised.slice(match[0].length);

  const lines = body
    .split("\n")
    .map(line => line.trim().replace(/\s+/g, " "))
    .filter(line => line !== "");

  return { lines, title };
}

/**
 * Fraction of lines the two bodies share, as a multiset intersection normalised by the longer side.
 *
 * Multiset rather than set, so a page that repeats a line ten times does not count as matching one
 * that uses it once. Normalised by the longer side, so a short page cannot score highly against a long
 * one just by being contained in it — the asymmetry matters, because a stub is not a rename of the
 * document that absorbed it.
 *
 * This is at least as large as the longest-common-subsequence ratio a diff tool reports, and costs one
 * pass instead of a quadratic table. Ordering is ignored, which is the right trade here: a page whose
 * sections were reordered is still the same page.
 */
export function contentScore(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const remaining = new Map<string, number>();
  for (const line of a) remaining.set(line, (remaining.get(line) ?? 0) + 1);

  let shared = 0;
  for (const line of b) {
    const left = remaining.get(line) ?? 0;
    if (left > 0) {
      remaining.set(line, left - 1);
      shared += 1;
    }
  }

  return shared / Math.max(a.length, b.length);
}

const TRAILING_QUALIFIER = /\.[a-z0-9]+$/;

/**
 * How alike the last slug segments are.
 *
 * The `0.7` for a stripped trailing qualifier earns its place: `drawer.component` → `drawer` is a
 * real rename on the measured corpus, and a heuristic that only knows about exact equality misses it
 * even though the two bodies are 96% identical.
 */
export function stemScore(a: readonly string[], b: readonly string[]): number {
  const left = a.at(-1) ?? "";
  const right = b.at(-1) ?? "";
  if (left === "" && right === "") return 1;
  if (left === right) return 1;

  const strippedLeft = left.replace(TRAILING_QUALIFIER, "");
  const strippedRight = right.replace(TRAILING_QUALIFIER, "");
  if (strippedLeft !== "" && strippedLeft === strippedRight) return 0.7;

  if (left.startsWith(right) || right.startsWith(left)) return 0.5;
  return 0;
}

/** Fraction of leading directory segments the two slugs agree on. */
export function pathScore(a: readonly string[], b: readonly string[]): number {
  const left = a.slice(0, -1);
  const right = b.slice(0, -1);
  const depth = Math.max(left.length, right.length);
  if (depth === 0) return 1;

  let shared = 0;
  while (shared < left.length && shared < right.length && left[shared] === right[shared]) shared += 1;
  return shared / depth;
}

/**
 * Title agreement, folded so punctuation and emoji do not decide it — documentation titles pick up and
 * lose a leading emoji routinely, and that is not a signal about identity.
 */
export function titleScore(a: string | undefined, b: string | undefined): number {
  if (a === undefined || b === undefined) return 0;
  const left = fold(a);
  const right = fold(b);
  if (left === "" || right === "") return 0;
  if (left === right) return 1;
  return left.includes(right) || right.includes(left) ? 0.5 : 0;
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
