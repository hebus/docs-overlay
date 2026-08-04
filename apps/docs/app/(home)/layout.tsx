import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";

import { baseOptions } from "@/lib/layout.shared";

export default function Layout({ children }: { children: ReactNode }) {
  const { nav, ...rest } = baseOptions();

  return (
    // The hero paints its own background, so the navbar sits on top of it until the first scroll.
    <HomeLayout {...rest} nav={{ ...nav, transparentMode: "top" }}>
      {children}
    </HomeLayout>
  );
}
