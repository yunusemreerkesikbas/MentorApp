"use client";

import { BottomSheetProvider } from "@mentor/ui";
import type { ReactNode } from "react";

/** Root-level BottomSheetProvider for imperative action/filter sheets. */
export function BottomSheetProviderShell({ children }: { children: ReactNode }) {
  return <BottomSheetProvider>{children}</BottomSheetProvider>;
}
