"use client";

import { BottomSheetProvider } from "@mentor/ui";
import type { ReactNode } from "react";

/** Root-level BottomSheetProvider for imperative action/filter sheets (Apple liquid glass & responsive bottom-up slide). */
export function BottomSheetProviderShell({ children }: { children: ReactNode }) {
  return <BottomSheetProvider>{children}</BottomSheetProvider>;
}
