"use client";

import { useTranslations } from "next-intl";
import type { VisionBoardItem } from "@mentor/types";
import { PLATE_COLORS, TEXT_COLORS, type ColorPanelTarget } from "./board-palettes";
import { Swatch } from "./board-swatch";

export interface BoardColorPanelProps {
  target: ColorPanelTarget;
  selected: VisionBoardItem | null;
  onPatch: (patch: Partial<VisionBoardItem>) => void;
}

/** The full colour grid. Its title and its way out are the panel's own header. */
export function BoardColorPanel({ target, selected, onPatch }: BoardColorPanelProps) {
  const t = useTranslations("vision.board");

  const colors = target === "text" ? TEXT_COLORS : PLATE_COLORS;

  const active =
    target === "text" && selected?.kind === "text"
      ? selected.color
      : target === "plate" && selected?.kind === "text"
        ? selected.background?.color
        : null;

  return (
    <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
      <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {target === "text" ? t("color") : t("plate")}
      </p>

      <div className="flex flex-wrap gap-2">
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
