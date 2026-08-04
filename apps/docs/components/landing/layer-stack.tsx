"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";

type Tag = "override" | "renamed" | "deleted" | "added" | undefined;

interface Sheet {
  version: string;
  note: string;
  /** Rendered back to front, so the oldest version is the sheet everything else sits on. */
  files: { name: string; tag?: Tag }[];
  /** Only the bottom sheet is opaque; the overlays let the tree below show through. */
  opaque?: boolean;
  empty?: string;
}

const SHEETS: Sheet[] = [
  {
    version: "1.0.0",
    note: "complete tree, frozen",
    opaque: true,
    files: [
      { name: "index.md" },
      { name: "guide/intro.md" },
      { name: "guide/old-api.md" },
      { name: "guide/legacy.md" },
      { name: "api/index.md" },
      { name: "meta.json" }
    ]
  },
  {
    version: "2.0.0",
    note: "3 files — the diff",
    files: [
      { name: "guide/intro.md", tag: "override" },
      { name: "guide/new-api.md", tag: "renamed" },
      { name: "guide/legacy.md", tag: "deleted" }
    ]
  },
  {
    version: "next",
    note: "nothing yet",
    empty: "inherits everything below",
    files: []
  }
];

const TAG_STYLE: Record<Exclude<Tag, undefined>, string> = {
  override: "bg-fd-diff-add text-fd-diff-add-symbol",
  added: "bg-fd-diff-add text-fd-diff-add-symbol",
  renamed: "bg-fd-accent text-fd-muted-foreground",
  deleted: "bg-fd-diff-remove text-fd-diff-remove-symbol"
};

/** Small enough that the sheets overlap, which is the whole point: you see the tree through them. */
const STEP = 78;

/**
 * The hero illustration is the mental model: each version is a translucent sheet laid over the
 * previous one, and only the bottom sheet carries the whole tree.
 */
export function LayerStack() {
  const container = useRef<HTMLDivElement>(null);
  const [spread, setSpread] = useState(false);
  const reduced = useReducedMotion() === true;

  const { scrollYProgress } = useScroll({ target: container, offset: ["start end", "end start"] });
  const drift = useSpring(useTransform(scrollYProgress, [0, 1], [26, -26]), { stiffness: 120, damping: 24 });

  return (
    <div
      ref={container}
      aria-hidden="true"
      className="relative h-[26rem] w-full origin-top scale-[0.7] select-none sm:scale-90 lg:h-[28rem] lg:scale-100"
      style={{ perspective: "1600px" }}
      onMouseEnter={() => setSpread(true)}
      onMouseLeave={() => setSpread(false)}>
      <motion.div className="absolute inset-0" style={reduced ? undefined : { y: drift }}>
        <div className="relative mx-auto h-full w-[22rem]" style={{ transform: "rotateX(20deg) rotateZ(-13deg)", transformStyle: "preserve-3d" }}>
          {SHEETS.map((sheet, index) => {
            const depth = SHEETS.length - 1 - index;
            const base = depth * STEP;
            const extra = spread && !reduced ? depth * 22 : 0;

            return (
              <motion.div
                key={sheet.version}
                className={`absolute inset-x-0 min-h-36 rounded-xl border border-fd-border shadow-xl ${sheet.opaque ? "bg-fd-card" : "bg-fd-card/55 backdrop-blur-sm"}`}
                style={{ top: base, zIndex: index }}
                initial={reduced ? false : { opacity: 0, y: 28, rotateZ: -4 }}
                animate={{ opacity: 1, y: extra, rotateZ: 0 }}
                transition={{ duration: 0.6, delay: reduced ? 0 : index * 0.12, ease: [0.16, 1, 0.3, 1] }}>
                <div className="flex items-baseline justify-between border-b border-fd-border px-4 py-2.5">
                  <span className="font-mono text-sm font-semibold text-do-accent">{sheet.version}/</span>
                  <span className="text-[11px] text-fd-muted-foreground">{sheet.note}</span>
                </div>

                <ul className="space-y-1 p-3 font-mono text-[11px] leading-5">
                  {sheet.files.map(file => (
                    <li key={file.name} className="flex items-center justify-between gap-3">
                      <span className="text-fd-muted-foreground">{file.name}</span>
                      {file.tag ? <span className={`rounded px-1.5 py-px text-[10px] ${TAG_STYLE[file.tag]}`}>{file.tag}</span> : null}
                    </li>
                  ))}
                  {sheet.empty ? <li className="text-[11px] text-fd-muted-foreground/70 italic">{sheet.empty}</li> : null}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
