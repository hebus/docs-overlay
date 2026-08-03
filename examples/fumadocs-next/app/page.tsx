import Link from "next/link";

import { overlay } from "@/lib/source";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-10">
      <h1 className="text-2xl font-semibold">docs-overlay</h1>
      <p>
        Five versions of the same documentation, where only the differences are written down. Pick one — the newest release is served at <code>/docs</code>.
      </p>
      <ul className="flex flex-col gap-1">
        {[...overlay.versions].reverse().map(version => (
          <li key={version.id}>
            <Link href={version.url}>
              {version.label}
              {version.isLatest ? " (latest)" : null}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
