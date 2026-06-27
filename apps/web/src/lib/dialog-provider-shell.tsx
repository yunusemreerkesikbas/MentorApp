"use client";

import { DialogProvider } from "@mentor/ui";
import type { ReactNode } from "react";

/** Root-level DialogProvider for imperative confirm/info/promo dialogs. */
export function DialogProviderShell({ children }: { children: ReactNode }) {
  return <DialogProvider>{children}</DialogProvider>;
}
