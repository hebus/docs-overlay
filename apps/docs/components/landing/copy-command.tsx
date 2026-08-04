"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/** A one-line install command that copies itself. Narrower and quieter than a full code block. */
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      // Clipboard access can be denied; the command is selectable, so there is nothing to recover.
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-fd-border bg-fd-card/70 py-1.5 pr-1.5 pl-4 font-mono text-sm backdrop-blur">
      <span aria-hidden="true" className="text-fd-muted-foreground select-none">
        $
      </span>
      <code className="overflow-x-auto whitespace-nowrap text-fd-foreground">{command}</code>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? "Command copied" : "Copy the install command"}
        className="ml-auto shrink-0 rounded-lg p-2 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground">
        {copied ? <Check className="size-4 text-do-accent-2" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
