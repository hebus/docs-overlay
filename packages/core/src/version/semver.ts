/**
 * Just enough semver to order version folders, written by hand so that
 * `@docs-overlay/core` keeps zero runtime dependencies.
 */

/** `[major, minor, patch, prerelease?]`. Build metadata is parsed and discarded, per the spec. */
export type SemverParts = readonly [major: number, minor: number, patch: number, prerelease?: string];

// Minor and patch are optional so that real-world documentation versions such as `2` or `3.1`
// are accepted; a leading `v` is tolerated.
const SEMVER = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

const NUMERIC = /^\d+$/;

/** Returns `undefined` when `id` is not a version number — a channel name such as `next`. */
export function parseSemver(id: string): SemverParts | undefined {
  const match = SEMVER.exec(id);
  if (match === null) return undefined;

  const major = Number(match[1] ?? "0");
  const minor = Number(match[2] ?? "0");
  const patch = Number(match[3] ?? "0");
  const prerelease = match[4];

  return prerelease === undefined ? [major, minor, patch] : [major, minor, patch, prerelease];
}

/** Whether `id` is a released version: valid semver with no prerelease part. */
export function isStableSemver(id: string): boolean {
  const parts = parseSemver(id);
  return parts !== undefined && parts[3] === undefined;
}

export function compareSemver(a: SemverParts, b: SemverParts): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  if (a[2] !== b[2]) return a[2] < b[2] ? -1 : 1;
  return comparePrerelease(a[3], b[3]);
}

/**
 * Per semver §11.3-11.4: a version with no prerelease outranks one that has one, identifiers are
 * compared dot-separated, numeric identifiers rank below alphanumeric ones, and a shorter set of
 * identifiers ranks lower when all the leading ones are equal.
 */
function comparePrerelease(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;

  const left = a.split(".");
  const right = b.split(".");
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const x = left[index];
    const y = right[index];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;

    const xNumeric = NUMERIC.test(x);
    const yNumeric = NUMERIC.test(y);
    if (xNumeric && yNumeric) return Number(x) < Number(y) ? -1 : 1;
    if (xNumeric) return -1;
    if (yNumeric) return 1;
    return x < y ? -1 : 1;
  }

  return 0;
}
