/**
 * Everything that came from the source gets escaped, once, here. A Mermaid label is author-controlled
 * text and the output is markup, so this is the boundary that decides whether a diagram can inject
 * into the page it is embedded in.
 *
 * `&` is replaced first — reverse the order and `<` becomes `&amp;lt;` instead of `&lt;`. Both quote
 * characters go too, because the same function serves attribute values, and an unescaped `"` there
 * would end the attribute and start a new one.
 */

const REPLACEMENTS: readonly (readonly [RegExp, string])[] = [
  [/&/g, "&amp;"],
  [/</g, "&lt;"],
  [/>/g, "&gt;"],
  [/"/g, "&quot;"],
  [/'/g, "&#39;"]
];

export function escapeSvgText(value: string): string {
  let escaped = value;
  for (const entry of REPLACEMENTS) {
    const [pattern, replacement] = entry;
    escaped = escaped.replace(pattern, replacement);
  }
  return escaped;
}

/**
 * For a value that lands in an attribute *and* must not carry control characters — an id, a class
 * name. Anything outside a conservative set is dropped rather than escaped, because these end up in
 * CSS selectors and `aria-labelledby` references where escaping is not enough.
 */
export function safeIdentifier(value: string): string {
  return value.replace(/[^\w-]/g, "-");
}

/** `key="value"` pairs, skipping anything undefined, so callers can build attributes conditionally. */
export function attributes(pairs: Readonly<Record<string, string | number | undefined>>): string {
  return Object.entries(pairs)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${key}="${typeof value === "number" ? round(value) : escapeSvgText(value)}"`)
    .join(" ");
}

/** Two decimals is below what a screen can show and keeps snapshots from churning on float noise. */
export function round(value: number): number {
  return Math.round(value * 100) / 100;
}
