"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * Hides the right-column companion (current-user profile + effort board) on focused pages where it
 * would just duplicate or distract: the ranking page (IS the full leaderboard) and any user profile
 * (`/community/member/...` — the page already leads with an identity + stats header; on your own profile the
 * companion is a literal duplicate). Feed/thread pages keep it. `usePathname` is locale-stripped.
 */
export function HideCompanion({ children }: { children: ReactNode }) {
  const path = usePathname();
  const hide = path === "/community/leaderboard" || path.startsWith("/community/member/");
  return hide ? null : <>{children}</>;
}
