"use client";

import type { ReactNode } from "react";
import { PuhuImage, type PuhuVariant } from "@/components/puhu-image";

const DIALOG_PUHU_SIZE = 72;

/** Promo dialog hero — Puhu mascot at 72px (Stitch Prompt 02 variant C). */
export function getDialogHero(puhuVariant: PuhuVariant = "encouraging"): ReactNode {
  return (
    <PuhuImage
      variant={puhuVariant}
      size={DIALOG_PUHU_SIZE}
      className="mx-auto"
    />
  );
}
