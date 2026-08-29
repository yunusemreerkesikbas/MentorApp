"use client";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { useState, type ReactNode } from "react";
import type { ToastVariant } from "@mentor/ui";

/**
 * Toast leading art. 40px box — same footprint the Puhu `sm` companion used, so swapping the
 * mascot out for status icons shifts no layout.
 *
 * Puhu was removed here on purpose: a toast paints over whatever page is already on screen, so a
 * mascot in the toast breaks DESIGN.md §8.3 ("at most one banner-class visual per page viewport")
 * every time it lands on a page that already shows one — and `TOAST_MAX_STACK` is 3, so it could
 * stack three mascots at once. Status also is not an emotion: ✓ vs ⚠ reads instantly where
 * happy-owl vs surprised-owl does not. The mascot still owns empty states, dialogs and the Koç hub.
 */
export const TOAST_ICON_PX = 40;

/**
 * Final art is supplied by design, never generated in-repo (DESIGN.md §8.1) — these paths are the
 * contract. Until a file lands, `ToastIcon` falls back to the token-coloured lucide glyph below,
 * so the toast is always legible and the box never collapses.
 */
const ART_BY_VARIANT: Record<ToastVariant, string> = {
  success: "/visuals/toast-success.svg",
  error: "/visuals/toast-error.svg",
  warning: "/visuals/toast-warning.svg",
  info: "/visuals/toast-info.svg",
};

const FALLBACK_BY_VARIANT: Record<
  ToastVariant,
  { Glyph: typeof CircleCheck; color: string; well: string }
> = {
  success: {
    Glyph: CircleCheck,
    color: "var(--color-success)",
    well: "color-mix(in srgb, var(--color-success) 14%, transparent)",
  },
  error: {
    Glyph: CircleAlert,
    color: "var(--color-danger)",
    well: "var(--color-error-container)",
  },
  warning: {
    Glyph: TriangleAlert,
    // DESIGN.md has no `--color-warning`; raw `--color-star` (#ffc700) lands at ~1.5:1 on its own
    // well, under the 3:1 non-text minimum (WCAG 1.4.11). Mixing toward `--color-main` keeps the
    // amber hue and adapts per theme on its own: main is ink in light, near-white in dark.
    color: "color-mix(in srgb, var(--color-star) 60%, var(--color-main))",
    well: "color-mix(in srgb, var(--color-star) 16%, transparent)",
  },
  info: {
    Glyph: Info,
    // Same story as `warning`: raw `--color-progress` sits at ~2.2:1 on its own well in light mode.
    color: "color-mix(in srgb, var(--color-progress) 65%, var(--color-main))",
    well: "color-mix(in srgb, var(--color-progress) 14%, transparent)",
  },
};

/** Token-coloured glyph in a soft well — the stand-in until the SVG art is dropped in. */
function FallbackIcon({ variant }: { variant: ToastVariant }) {
  const { Glyph, color, well } = FALLBACK_BY_VARIANT[variant];
  return (
    <span
      className="flex items-center justify-center rounded-full"
      style={{ width: TOAST_ICON_PX, height: TOAST_ICON_PX, backgroundColor: well }}
    >
      <Glyph size={24} color={color} strokeWidth={2} aria-hidden />
    </span>
  );
}

/**
 * Status icon for a toast. Renders the supplied SVG; if that file is not there yet (or fails to
 * load) it swaps to the lucide fallback rather than showing a broken image.
 */
export function ToastIcon({ variant }: { variant: ToastVariant }) {
  const [artFailed, setArtFailed] = useState(false);
  if (artFailed) return <FallbackIcon variant={variant} />;

  return (
    // A fixed 40px SVG from /public gains nothing from next/image (no remote host, no responsive
    // sizing) and loses on both counts: its lazy default leaves the icon slot blank for a beat on
    // every toast, and the optimizer refuses SVG without `dangerouslyAllowSVG`.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ART_BY_VARIANT[variant]}
      alt=""
      width={TOAST_ICON_PX}
      height={TOAST_ICON_PX}
      onError={() => setArtFailed(true)}
      aria-hidden
    />
  );
}

/** Error circle reused by the confirm dialog (Stitch Prompt 13). */
export function ErrorLeading() {
  return <FallbackIcon variant="error" />;
}

/** Maps toast variant → status icon. */
export function getToastLeading(variant: ToastVariant): ReactNode {
  return <ToastIcon variant={variant} />;
}
