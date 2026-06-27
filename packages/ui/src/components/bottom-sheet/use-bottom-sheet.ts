"use client";

import { useContext } from "react";
import { BottomSheetContext } from "./bottom-sheet-provider.js";
import type { BottomSheetContextValue } from "./types.js";

export function useBottomSheet(): BottomSheetContextValue {
  const ctx = useContext(BottomSheetContext);
  if (!ctx) {
    throw new Error("useBottomSheet must be used within BottomSheetProvider");
  }
  return ctx;
}
