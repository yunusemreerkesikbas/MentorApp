"use client";

import { useContext } from "react";
import { DialogContext } from "./dialog-provider.js";
import type { DialogContextValue } from "./types.js";

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used within DialogProvider");
  }
  return ctx;
}
