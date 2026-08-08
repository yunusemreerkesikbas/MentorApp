"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VisionBoardDoc, VisionBoardItem } from "@mentor/types";
import {
  BOARD_COLORS,
  PLATE_COLORS,
  TEXT_COLORS,
  type ColorPanelTarget,
} from "./board-palettes";

export interface BoardColorPanelProps {
  target: ColorPanelTarget;
  selected: VisionBoardItem | null;
  doc: VisionBoardDoc;
  onPatch: (patch: Partial<VisionBoardItem>) => void;
  onSetBackground: (background: VisionBoardDoc["background"]) => void;
  onClose: () => void;
}

export function BoardColorPanel({
  target,
  selected,
  doc,
  onPatch,
  onSetBackground,
  onClose,
}: BoardColorPanelProps) {
  const t = useTranslations("vision.board");

  const colors =
    target === "text" ? TEXT_COLORS : target === "plate" ? PLATE_COLORS : BOARD_COLORS;

  const active =
    target === "text" && selected?.kind === "text"
      ? selected.color
      : target === "plate" && selected?.kind === "text"
        ? selected.background?.color
        : target === "board" && doc.background.kind === "color"
          ? doc.background.value
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
        {target === "text"
          ? t("color")
          : target === "plate"
            ? t("plate")
            : t("background")}
      </p>

      <div className="flex flex-wrap gap-1">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${t("color")}: ${color}`}
            aria-pressed={active === color}
            onClick={() => {
              if (target === "text" && selected?.kind === "text") {
                onPatch({ color });
                return;
              }
              if (target === "plate" && selected?.kind === "text" && selected.background) {
                onPatch({ background: { ...selected.background, color } });
                return;
              }
              if (target === "board") {
                onSetBackground({ kind: "color", value: color });
              }
            }}
            className="grid h-11 w-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <span
              className="block h-6 w-6 rounded-full"
              style={{
                backgroundColor: color,
                outline:
                  active === color
                    ? "2px solid var(--color-accent)"
                    : "1px solid rgba(0,0,0,0.12)",
                outlineOffset: "2px",
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
