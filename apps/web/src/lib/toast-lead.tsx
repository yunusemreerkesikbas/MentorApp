"use client";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import type { ReactNode } from "react";
import type { ToastVariant } from "@mentor/ui";

/**
 * Toast status glyph: a bare line icon, no well (overlay kit, 2026-09-28; the pastel wells read as
 * template chrome). The `/visuals/toast-*.svg` art slot is gone with them: the files never landed,
 * so every toast paid a 404 before falling back to these glyphs anyway.
 *
 * No Puhu here on purpose: a toast paints over whatever page is already on screen, so a mascot
 * breaks DESIGN.md §8.3 ("at most one banner-class visual per page viewport") and
 * `TOAST_MAX_STACK` could stack three. Status is not an emotion: ✓ vs ⚠ reads instantly.
 */
const GLYPH_BY_VARIANT: Record<ToastVariant, { Glyph: typeof CircleCheck; color: string }> = {
  success: { Glyph: CircleCheck, color: "var(--color-success)" },
  error: { Glyph: CircleAlert, color: "var(--color-danger)" },
  // DESIGN.md has no `--color-warning`; raw `--color-star` (#ffc700) is ~1.5:1 on white, under the
  // 3:1 non-text minimum (WCAG 1.4.11). Mixing toward `--color-main` keeps the amber (~3.8:1) and
  // adapts per theme on its own: main is ink in light, near-white in dark.
  warning: {
    Glyph: TriangleAlert,
    color: "color-mix(in srgb, var(--color-star) 60%, var(--color-main))",
  },
  info: { Glyph: Info, color: "var(--play-selected-ink)" },
};

/** Maps toast variant → status glyph. */
export function getToastLeading(variant: ToastVariant): ReactNode {
  const { Glyph, color } = GLYPH_BY_VARIANT[variant];
  return <Glyph size={22} strokeWidth={1.75} color={color} aria-hidden />;
}
