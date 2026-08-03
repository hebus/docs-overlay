import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">docs-overlay</h1>
        <p className="text-fd-muted-foreground">
          Versioned documentation where you author only the diff between versions. The oldest folder holds the complete tree; every newer version contains just
          what changed.
        </p>
      </div>

      <pre className="overflow-x-auto rounded-lg border p-4 text-sm">
        <code>{`content/docs/
  1.0.0/                 complete tree, frozen
  2.0.0/
    guide/intro.md         an override
    guide/new-api.md       overlay: { renamedFrom: guide/old-api }
    guide/legacy.md        overlay: { deleted: true }
  next/                  work in progress`}</code>
      </pre>

      <p>
        Cutting a release is <code>git mv next 2.1.0 &amp;&amp; mkdir next</code> — a zero-byte content diff, because git records it as renames.
      </p>

      <div className="flex gap-4">
        <Link href="/docs" className="font-medium underline">
          Read the documentation
        </Link>
        <a href="https://github.com/hebus/docs-overlay" className="font-medium underline">
          GitHub
        </a>
      </div>
    </main>
  );
}
