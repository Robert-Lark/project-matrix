import type { ReactNode } from "react";
import { Document, EDITORIAL_CSS } from "@/lib/document";

// One root layout per route group (Next's multiple-root-layouts pattern) so
// each surface's document carries ITS master's stylesheet list — the astro
// `css`-prop precedent, in this framework's idiom. The skeleton and the
// font-loading rationale live in src/lib/document.tsx.
export default function EditorialLayout({ children }: { children: ReactNode }) {
  return <Document css={EDITORIAL_CSS}>{children}</Document>;
}
