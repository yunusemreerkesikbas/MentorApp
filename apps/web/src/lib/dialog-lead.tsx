"use client";
import { CircleAlert, CircleHelp } from "lucide-react";

import type { ReactNode } from "react";

/**
 * Default confirm glyph: bare, 28px, no well (overlay kit, 2026-09-28). A question for an ordinary
 * confirm; danger red only when the confirm cannot be undone. Call sites with a truer symbol pass
 * their own `leading`.
 */
export function getDialogLeading(destructive = false): ReactNode {
  return destructive ? (
    <CircleAlert size={28} strokeWidth={1.75} color="var(--color-danger)" aria-hidden />
  ) : (
    <CircleHelp size={28} strokeWidth={1.75} color="var(--play-selected-ink)" aria-hidden />
  );
}
