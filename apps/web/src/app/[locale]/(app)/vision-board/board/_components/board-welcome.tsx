"use client";

import { ChevronRight, ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import { PANEL_TEXT_LINK } from "@/components/panel/panel-styles";

/**
 * Under a board nobody has touched yet: Puhu says one line and offers the two ways in. It sits
 * below the board, never over it, so it needs no way to be dismissed; the first thing added or
 * rewritten takes it away for good.
 */
export function BoardWelcome({
  onAddImage,
  onOpenTemplates,
}: {
  onAddImage: () => void;
  onOpenTemplates: () => void;
}) {
  const t = useTranslations("vision.board");

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
      <div className="min-w-0 flex-1">
        <CompanionBubble puhu="encouraging" text={t("welcome_line")} />
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1 lg:flex-row lg:gap-4">
        <Button size="sm" className="max-lg:w-full" onClick={onAddImage}>
          <ImagePlus aria-hidden size={18} strokeWidth={2.25} />
          {t("add_image_cta")}
        </Button>
        <button type="button" onClick={onOpenTemplates} className={`cursor-pointer ${PANEL_TEXT_LINK}`}>
          {t("welcome_template")}
          <ChevronRight aria-hidden size={16} />
        </button>
      </div>
    </div>
  );
}
