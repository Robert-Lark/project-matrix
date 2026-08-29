import type { ReactNode } from "react";
import { Document, PLP_CSS } from "@/lib/document";

// The PLP group's root layout — see (editorial)/layout.tsx for the pattern.
// The two BENCHMARKED strategies share this document because they must serve
// the master's stylesheet list exactly; the fenced Apollo exhibit needs one
// more sheet and therefore its own group, (plp-apollo).
export default function PlpLayout({ children }: { children: ReactNode }) {
  return <Document css={PLP_CSS}>{children}</Document>;
}
