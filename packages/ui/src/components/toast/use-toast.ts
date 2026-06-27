"use client";

import { useContext } from "react";
import { ToastContext } from "./toast-provider.js";
import type { ToastContextValue } from "./types.js";

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
