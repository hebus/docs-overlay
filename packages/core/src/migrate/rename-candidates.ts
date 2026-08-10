/**
 * Ranking the slugs a vanished page might have become.
 *
 * The hard part is not the score. It is knowing which candidates are eligible at all, and knowing when
 * the weighted score is the wrong thing to trust.
 */

import type { Slug, SlugKey } from "../models/ids.js";
import { slugKey } from "../models/ids.js";
import type { Comparable } from "./similarity.js";
import { contentScore, pathScore, stemScore, titleScore } from "./similarity.js";

export interface CandidateWeights {
  readonly content: number;
  readonly stem: number;
  readonly path: number;
  readonly title: number;
}

/**
 * Content dominates because it is the only axis that cannot be coincidence. Names, folders and titles
 * are corroboration: on the measured corpus every one of them, taken alone, proposes at least one
 * rename that never happened.
 */
export const DEFAULT_WEIGHTS: CandidateWeights = { content: 0.6, stem: 0.2, path: 0.15, title: 0.05 };

export interface CandidateThresholds {
  /** Weighted score at or above which a rename needs no human. */
  readonly accept: number;
  /** Weighted score below which nothing is even proposed. */
  readonly ask: number;
  /** How far ahead of the runner-up `accept` must be. */
  readonly margin: number;
  /** Content score at or above which an otherwise-unmatched candidate is accepted outright. */
  readonly identicalBody: number;
  /** Runner-up content score below which `identicalBody` is allowed to fire. */
  readonly identicalBodyMargin: number;
}

export const DEFAULT_THRESHOLDS: CandidateThresholds = {
  accept: 0.75,
  ask: 0.45,
  margin: 0.15,
  identicalBody: 0.95,
  identicalBodyMargin: 0.5
};

export type Ineligible =
  /** The parent version already served this slug, so the two pages coexisted. */
  "existed-in-parent";

export interface RenameCandidate {
  readonly slug: Slug;
  /** Path within the version that introduces it, extension included. */
  readonly path: string;
  readonly score: number;
  readonly evidence: { readonly content: number; readonly stem: number; readonly path: number; readonly title: number };
  /** Set when the candidate cannot be a rename target at all. It stays offerable as `replacedBy`. */
  readonly ineligible?: Ineligible | undefined;
}

export interface CandidateInput {
  readonly slug: Slug;
  readonly path: string;
  readonly body: Comparable;
  /** Whether the parent version already served this slug. */
  readonly existedInParent: boolean;
}

export type Verdict =
  /** Accepted on the weighted score, clear of the runner-up. */
  | "rename"
  /** Accepted because the body is line-identical and nothing else comes close. */
  | "rename-identical-body"
  /** Nothing plausible at all: a tombstone with no replacement, and no question worth asking. */
  | "tombstone"
  /** Needs a human. `candidates` is ranked, `ineligible` entries included. */
  | "ask";

export interface Ranking {
  readonly verdict: Verdict;
  readonly candidates: readonly RenameCandidate[];
  /** The winner, when the verdict is one of the two rename kinds. */
  readonly accepted: RenameCandidate | undefined;
}

/**
 * Ranks `candidates` as possible new homes for `gone`, and says whether a human is needed.
 *
 * Two rules here were forced by a real corpus rather than designed, and both are worth stating because
 * they are what separates a heuristic that helps from one that confidently lies.
 *
 * **A candidate the parent already served can never be a rename target.** The two pages coexisted, so a
 * permanent redirect between them would claim a move that never happened. On the measured corpus
 * `atomic/changelog` scores a perfect stem and a perfect title against both `changelog` and
 * `atomic-angular/changelog`, and a name-driven heuristic picks one of them with confidence and is
 * wrong. Marking them ineligible turns a bad answer into an answerable question, because they remain
 * available as `replacedBy` suggestions.
 *
 * **A line-identical body beats any filename.** `mint/configurations/customization` became
 * `mint/configurations/customization/custom-json-files`: 397 lines on both sides, body identical, only
 * the frontmatter changed. It scores `content 1.00` against a runner-up at `0.22`, and still lands at
 * `0.700` — under the accept threshold — purely because the stem changed. Left to the weighted score
 * alone, the strongest evidence available produces a needless question. Hence the separate branch, with
 * a uniqueness guard so a genuinely duplicated page is not mistaken for a move.
 */
export function rankCandidates(
  gone: Comparable,
  goneSlug: Slug,
  candidates: readonly CandidateInput[],
  weights: CandidateWeights = DEFAULT_WEIGHTS,
  thresholds: CandidateThresholds = DEFAULT_THRESHOLDS
): Ranking {
  const scored: RenameCandidate[] = candidates.map(candidate => {
    const evidence = {
      content: contentScore(gone.lines, candidate.body.lines),
      stem: stemScore(goneSlug, candidate.slug),
      path: pathScore(goneSlug, candidate.slug),
      title: titleScore(gone.title, candidate.body.title)
    };
    const score = weights.content * evidence.content + weights.stem * evidence.stem + weights.path * evidence.path + weights.title * evidence.title;

    return candidate.existedInParent
      ? { slug: candidate.slug, path: candidate.path, score, evidence, ineligible: "existed-in-parent" }
      : { slug: candidate.slug, path: candidate.path, score, evidence };
  });

  // Ties broken by slug so the ranking is stable: a plan that reorders between runs cannot be replayed.
  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : slugKey(a.slug).localeCompare(slugKey(b.slug))));

  const eligible = scored.filter(candidate => candidate.ineligible === undefined);
  const best = eligible[0];
  const second = eligible[1];

  if (best !== undefined && best.evidence.content >= thresholds.identicalBody) {
    if (second === undefined || second.evidence.content < thresholds.identicalBodyMargin) {
      return { verdict: "rename-identical-body", candidates: scored, accepted: best };
    }
  }

  if (best !== undefined && best.score >= thresholds.accept) {
    if (second === undefined || best.score - second.score >= thresholds.margin) {
      return { verdict: "rename", candidates: scored, accepted: best };
    }
    return { verdict: "ask", candidates: scored, accepted: undefined };
  }

  if (best !== undefined && best.score >= thresholds.ask) {
    return { verdict: "ask", candidates: scored, accepted: undefined };
  }

  // Nothing eligible is plausible. An ineligible candidate that looks related is still worth a question,
  // because the answer is `replacedBy` rather than a rename — a different question with a different
  // outcome, and one only a human can settle.
  const plausibleIneligible = scored.some(
    candidate => candidate.ineligible !== undefined && (candidate.score >= thresholds.ask || candidate.evidence.stem >= 0.7)
  );
  if (plausibleIneligible) return { verdict: "ask", candidates: scored, accepted: undefined };

  return { verdict: "tombstone", candidates: scored, accepted: undefined };
}

/** The subset a prompt should offer as `replacedBy`, ranked: ineligible-but-related candidates first. */
export function replacementSuggestions(candidates: readonly RenameCandidate[]): readonly SlugKey[] {
  return candidates
    .filter(candidate => candidate.ineligible !== undefined || candidate.score > 0)
    .slice(0, 3)
    .map(candidate => slugKey(candidate.slug));
}
