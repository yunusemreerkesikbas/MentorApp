"use client";

import { ToastProvider } from "@mentor/ui";
import type { ReactNode } from "react";
import { getToastLeading } from "./toast-lead";

/** Root-level ToastProvider with Mentor Puhu / error icon mapping. */
export function ToastProviderShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider renderLeading={getToastLeading}>{children}</ToastProvider>
  );
}
