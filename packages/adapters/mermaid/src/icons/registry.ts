/**
 * Icons are the one thing that reaches the SVG unescaped — they *are* markup, so escaping them would
 * turn them into visible text. That makes the registry the place the check has to happen, and it
 * happens on registration rather than on render: a bad icon then fails once, at the point somebody
 * can fix it, instead of silently on every diagram that uses it.
 *
 * The default set is built into the package, so a caller who registers nothing is never exposed to
 * this at all.
 */

import { MermaidError } from "../errors.js";
import type { IconDefinition } from "./default-icons.js";
import { defaultIcons } from "./default-icons.js";

export type { IconDefinition } from "./default-icons.js";

export interface IconRegistry {
  readonly get: (name: string) => IconDefinition | undefined;
}

/**
 * What an icon may not contain. `<use>` and `<image>` are refused along with the obvious ones because
 * both take a URL, and a URL is a network request at render time — the thing this package promises
 * never to make.
 */
const FORBIDDEN: readonly (readonly [RegExp, string])[] = [
  [/<\s*script/i, "a <script> element"],
  [/<\s*foreignObject/i, "a <foreignObject> element"],
  [/<\s*(?:use|image)\b/i, "a <use> or <image> element, which would fetch a URL at render time"],
  [/\bon[a-z]+\s*=/i, "an event handler attribute"],
  [/javascript\s*:/i, "a `javascript:` URL"],
  [/\bdata\s*:\s*text\/html/i, "a `data:text/html` URL"]
];

export function assertSafeIcon(icon: IconDefinition): void {
  for (const entry of FORBIDDEN) {
    const [pattern, what] = entry;
    if (pattern.test(icon.content)) {
      throw new MermaidError("unsafe-icon", `The icon \`${icon.id}\` contains ${what}. Icon content is inlined into the SVG, so it must be geometry only.`);
    }
  }
}

export function createIconRegistry(icons: readonly IconDefinition[] = defaultIcons): IconRegistry {
  const byName = new Map<string, IconDefinition>();
  for (const icon of icons) {
    assertSafeIcon(icon);
    byName.set(icon.id, icon);
  }
  return { get: name => byName.get(name) };
}

/**
 * Extra icons on top of the built-in set, which is what a consumer almost always wants: a
 * `credit-card` for their payments service, not a replacement for `database`.
 */
export function extendIconRegistry(icons: readonly IconDefinition[]): IconRegistry {
  return createIconRegistry([...defaultIcons, ...icons]);
}

export const defaultIconRegistry: IconRegistry = createIconRegistry();
