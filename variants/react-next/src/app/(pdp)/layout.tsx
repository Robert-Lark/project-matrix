import type { ReactNode } from "react";
import { Document, PDP_CSS } from "@/lib/document";

// The PDP group's root layout — see (editorial)/layout.tsx for the pattern.
export default function PdpLayout({ children }: { children: ReactNode }) {
  return <Document css={PDP_CSS}>{children}</Document>;
}
