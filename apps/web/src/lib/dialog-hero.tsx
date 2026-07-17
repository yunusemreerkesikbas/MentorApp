"use client";

import type { ReactNode } from "react";
import { PuhuImage, type PuhuVariant } from "@/components/puhu-image";

/** Promo dialog hero — Puhu mascot at `md` (72px; DESIGN.md §8.2). */
export function getDialogHero(puhuVariant: PuhuVariant = "encouraging"): ReactNode {
  return (
    <PuhuImage
      variant={puhuVariant}
      size="md"
      className="mx-auto"
    />
  );
}
