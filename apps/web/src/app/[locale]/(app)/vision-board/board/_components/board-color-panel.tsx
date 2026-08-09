"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VisionBoardItem } from "@mentor/types";
import { PLATE_COLORS, TEXT_COLORS, type ColorPanelTarget } from "./board-palettes";
import { Swatch } from "./board-swatch";

export interface BoardColorPanelProps {
  target: ColorPanelTarget;
  selected: VisionBoardItem | null;
  onPatch: (patch: Partial<VisionBoardItem>) => void;
  onClose: () => void;
}

export function BoardColorPanel({ target, selected, onPatch, onClose }: BoardColorPanelProps) {
  const t = useTranslations("vision.board");

  const colors = target === "text" ? TEXT_COLORS : PLATE_COLORS;

  const active =
    target === "text" && selected?.kind === "text"
      ? selected.color
      : target === "plate" && selected?.kind === "text"
        ? selected.background?.color
        : null;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2
          className="text-sm font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("color_panel_title")}
        </h2>
        <button
          type="button"
          aria-label={t("color_panel_close")}
          onClick={onClose}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-main)" }}
        >
          <X aria-hidden size={18} />
        </button>
      </div>

      <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {target === "text" ? t("color") : t("plate")}
      </p>

      <div className="flex flex-wrap gap-2 pt-2">
        {colors.map((color) => (
          <Swatch
            key={color}
            color={color}
            label={t("color")}
            active={active === color}
            size="lg"
            onClick={() => {
              if (target === "text" && selected?.kind === "text") {
                onPatch({ color });
                return;
              }
              if (target === "plate" && selected?.kind === "text" && selected.background) {
                onPatch({ background: { ...selected.background, color } });
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
