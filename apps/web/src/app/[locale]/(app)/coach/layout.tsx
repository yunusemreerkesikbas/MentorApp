import type { ReactNode } from "react";
import { CoachAccessShell } from "./_components/coach-access-shell";

export default function CoachLayout({ children }: { children: ReactNode }) {
  return <CoachAccessShell>{children}</CoachAccessShell>;
}
