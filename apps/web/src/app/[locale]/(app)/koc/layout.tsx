import type { ReactNode } from "react";
import { KocAccessShell } from "./_components/koc-access-shell";

export default function KocLayout({ children }: { children: ReactNode }) {
  return <KocAccessShell>{children}</KocAccessShell>;
}
