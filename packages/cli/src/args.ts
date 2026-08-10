/**
 * A parser small enough to read in one sitting.
 *
 * No dependency, because the surface is four commands and a dozen flags, and because an argument parser
 * that surprises you is worse than one you can hold in your head. Unknown flags are an error rather than
 * a shrug: a mistyped `--dry-run` that silently does the real thing is the one failure this tool cannot
 * afford.
 */

export interface Parsed {
  readonly command: string | undefined;
  readonly rest: readonly string[];
  readonly flags: Readonly<Record<string, string | boolean>>;
}

export function parseArgs(argv: readonly string[], known: readonly string[]): Parsed {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  const booleans = new Set(known.filter(name => !name.endsWith("=")).map(name => name.replace(/^--/, "")));
  const valued = new Set(known.filter(name => name.endsWith("=")).map(name => name.replace(/^--/, "").replace(/=$/, "")));

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;

    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }

    const [name, inline] = splitOnce(argument.slice(2), "=");
    if (valued.has(name)) {
      const value = inline ?? argv[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`--${name} needs a value.`);
      flags[name] = value;
      if (inline === undefined) index += 1;
      continue;
    }
    if (booleans.has(name)) {
      if (inline !== undefined) throw new Error(`--${name} is a flag and takes no value.`);
      flags[name] = true;
      continue;
    }
    throw new Error(`Unknown option --${name}. Run \`docs-overlay --help\`.`);
  }

  return { command: positional[0], rest: positional.slice(1), flags };
}

function splitOnce(value: string, separator: string): [string, string | undefined] {
  const index = value.indexOf(separator);
  return index === -1 ? [value, undefined] : [value.slice(0, index), value.slice(index + 1)];
}

export const stringFlag = (flags: Parsed["flags"], name: string): string | undefined => {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
};

export const boolFlag = (flags: Parsed["flags"], name: string): boolean => flags[name] === true;
