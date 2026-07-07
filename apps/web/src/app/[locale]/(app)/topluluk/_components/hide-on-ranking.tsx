"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * Hides the right-column companion (profile + effort board) on the dedicated ranking page — that
 * page IS the full leaderboard, so the compact companion would just duplicate it. Feed/thread pages
 * keep the companion. `usePathname` is locale-stripped (e.g. "/topluluk/siralama").
 */
export function HideOnRanking({ children }: { children: ReactNode }) {
  return usePathname() === "/topluluk/siralama" ? null : <>{children}</>;
}
