import Link from "next/link";

const LINKS = [
  { label: "Documentation", href: "/docs", internal: true },
  { label: "GitHub", href: "https://github.com/hebus/docs-overlay" },
  { label: "docs-overlay", href: "https://www.npmjs.com/package/docs-overlay" },
  { label: "docs-overlay-fumadocs", href: "https://www.npmjs.com/package/docs-overlay-fumadocs" },
  { label: "docs-overlay-docusaurus", href: "https://www.npmjs.com/package/docs-overlay-docusaurus" },
  { label: "docs-overlay-cli", href: "https://www.npmjs.com/package/docs-overlay-cli" },
  { label: "docs-overlay-mermaid", href: "https://www.npmjs.com/package/docs-overlay-mermaid" }
];

export function Footer() {
  return (
    <footer className="border-t border-fd-border px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 text-sm text-fd-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-medium text-fd-foreground">docs-overlay</span> — MIT licence.
        </p>

        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map(link =>
            link.internal ? (
              <Link key={link.label} href={link.href} className="transition-colors hover:text-fd-foreground">
                {link.label}
              </Link>
            ) : (
              <a key={link.label} href={link.href} rel="noreferrer" className="transition-colors hover:text-fd-foreground">
                {link.label}
              </a>
            )
          )}
        </nav>
      </div>
    </footer>
  );
}
