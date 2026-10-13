"use client";

import { ImagePlus, LayoutTemplate, PanelTop, Smile, Type } from "lucide-react";
import { useTranslations } from "next-intl";
// ponytail: the notebook's rail pieces, imported as they are; move them to components/stage when a third editor needs them.
import { NotebookRailActiveFill } from "../../../notebook/_components/notebook-rail-items";
import { NOTEBOOK_TRAY_RADIUS_CLASS } from "../../../notebook/_components/notebook-shell-layout";
import type { BoardPanelCategory } from "./board-side-panel";

/**
 * Stacking of the editor's own chrome. The rail sits above the panel: on a phone it is the dock
 * the sheet rises behind.
 */
export const BOARD_CHROME_Z = { panel: 30, rail: 40 } as const;

export const BOARD_CATEGORY_LABEL_KEYS = {
  image: "nav_image",
  text: "nav_text",
  sticker: "nav_sticker",
  template: "nav_template",
  board: "nav_board",
} as const satisfies Record<BoardPanelCategory, string>;

const CATEGORIES: { id: BoardPanelCategory; icon: typeof ImagePlus }[] = [
  { id: "image", icon: ImagePlus },
  { id: "text", icon: Type },
  { id: "sticker", icon: Smile },
  { id: "template", icon: LayoutTemplate },
  { id: "board", icon: PanelTop },
];

/**
 * The editor's tools: the notebook's stadium rail (DESIGN.md §11). From `lg` it floats at the
 * board's left edge; below it is a dock under the board, within the thumb's reach.
 */
export function BoardEditorRail({
  active,
  sheetOpen,
  reduceMotion,
  onOpen,
}: {
  /** The category whose panel is showing, or null while the panel is shut. */
  active: BoardPanelCategory | null;
  /** Below `lg` an open panel is a sheet behind this dock, so the dock drops its own outline. */
  sheetOpen: boolean;
  reduceMotion: boolean | null;
  onOpen: (id: BoardPanelCategory) => void;
}) {
  const t = useTranslations("vision.board");

  return (
    <nav
      aria-label={t("editor_nav")}
      className={`relative mx-3 mb-[calc(0.75rem+env(safe-area-inset-bottom))] flex shrink-0 gap-0.5 border border-[color-mix(in_srgb,var(--color-main)_10%,transparent)] bg-[var(--color-surface)] px-2 py-1 shadow-[var(--shadow-card)] lg:absolute lg:left-2 lg:top-1/2 lg:m-0 lg:w-[4.5rem] lg:-translate-y-1/2 lg:flex-col lg:gap-1 lg:px-1 lg:py-3 ${NOTEBOOK_TRAY_RADIUS_CLASS} ${sheetOpen ? "max-lg:border-transparent max-lg:shadow-none" : ""}`}
      style={{ zIndex: BOARD_CHROME_Z.rail }}
    >
      {CATEGORIES.map(({ id, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={isActive}
            aria-expanded={isActive}
            onClick={() => onOpen(id)}
            className="relative flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[var(--radius-card)] px-1 py-1.5 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] lg:w-full lg:flex-none lg:gap-1 lg:py-2"
            style={{ color: isActive ? "var(--play-selected-ink)" : "var(--color-secondary)" }}
          >
            {isActive ? <NotebookRailActiveFill reduceMotion={reduceMotion} /> : null}
            <Icon aria-hidden size={20} className="relative z-[1]" />
            <span className="relative z-[1] w-full truncate text-center leading-tight">
              {t(BOARD_CATEGORY_LABEL_KEYS[id])}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
