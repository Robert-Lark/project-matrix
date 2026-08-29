import type { ReactNode } from "react";
import { Document, PLP_APOLLO_CSS } from "@/lib/document";

// The fenced exhibit's root layout. A SEPARATE route group purely so the
// plaque's stylesheet rides on the exhibit alone: two route groups may not
// resolve to the same URL path (Next's route-groups doc, "Conflicting paths"),
// and /plp/plain, /plp/tanstack and /plp/apollo are three distinct paths, so
// the split is legal and costs the benchmarked routes nothing.
export default function PlpApolloLayout({ children }: { children: ReactNode }) {
  return <Document css={PLP_APOLLO_CSS}>{children}</Document>;
}
