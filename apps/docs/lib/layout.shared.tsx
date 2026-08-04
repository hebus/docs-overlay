import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: "docs-overlay", url: "/" },
    links: [{ text: "Documentation", url: "/docs", active: "nested-url" }],
    githubUrl: "https://github.com/hebus/docs-overlay"
  };
}
