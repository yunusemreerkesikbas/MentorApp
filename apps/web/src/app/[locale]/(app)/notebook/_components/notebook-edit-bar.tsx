"use client";

import { useState } from "react";
import { Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { NOTEBOOK_PAPERS, type NotebookPaper, type VisionSticker } from "@mentor/types";
import { Button } from "@mentor/ui";
import { STICKER_ART } from "@/components/vision-board/board-stickers";

/**
 * Arranging controls: stickers, a note, paper, undo, delete.
 *
 * A short sticker shortlist rather than the board's full 77-value palette. This bar sits under a
 * page the user came to *review*, not to decorate for an hour; the long tail belongs on the vision
 * board, where decorating is the point.
 * ponytail: fixed shortlist — promote to the board's searchable panel if anyone asks for the rest.
 */
const SHORTLIST: VisionSticker[] = [
  "STAR",
  "SPARKLE",
  "TARGET",
  "CHECK",
  "LIGHTNING",
  "HEART",
  "TAPE_DIAGONAL",
  "PUHU_ENCOURAGING",
];

/** Same two-shape render the board's sticker panel uses: a mascot PNG or a single SVG path. */
function StickerPreview({ asset }: { asset: VisionSticker }) {
  const art = STICKER_ART[asset];
  if (art.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- same-origin mascot PNG
    return <img src={art.src} alt="" className="size-7 object-contain" />;
  }
  return (
    <svg viewBox="0 0 100 100" className="size-6" aria-hidden>
      <path d={art.path} fill={art.fill} fillRule={art.fillRule} />
    </svg>
  );
}

interface NotebookEditBarProps {
  paper: NotebookPaper;
  canUndo: boolean;
  hasSelection: boolean;
  onAddSticker: (asset: VisionSticker) => void;
  onAddNote: (text: string) => void;
  onSetPaper: (paper: NotebookPaper) => void;
  onUndo: () => void;
  onDeleteSelected: () => void;
}

export function NotebookEditBar({
  paper,
  canUndo,
  hasSelection,
  onAddSticker,
  onAddNote,
  onSetPaper,
  onUndo,
  onDeleteSelected,
}: NotebookEditBarProps) {
  const t = useTranslations("notebook");
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {SHORTLIST.map((asset) => (
          <button
            key={asset}
            type="button"
            onClick={() => onAddSticker(asset)}
            aria-label={t("edit_add_sticker")}
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] border outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              borderColor: "color-mix(in srgb, var(--color-main) 12%, transparent)",
              backgroundColor: "var(--color-surface)",
            }}
          >
            <StickerPreview asset={asset} />
          </button>
        ))}

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={t("edit_undo")}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] border outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: "color-mix(in srgb, var(--color-main) 12%, transparent)",
            color: "var(--color-main)",
          }}
        >
          <Undo2 className="size-5" aria-hidden />
        </button>

        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={!hasSelection}
          aria-label={t("edit_delete")}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] border outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: "color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-main)" }}>
          {t("edit_paper")}
          <select
            value={paper}
            onChange={(event) => onSetPaper(event.target.value as NotebookPaper)}
            className="min-h-11 rounded-[var(--radius-card)] border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
              backgroundColor: "var(--color-surface)",
            }}
          >
            {NOTEBOOK_PAPERS.map((value) => (
              <option key={value} value={value}>
                {t(`paper.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = note.trim();
          if (!trimmed) return;
          onAddNote(trimmed);
          setNote("");
        }}
      >
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("edit_note_placeholder")}
          maxLength={280}
          className="min-h-11 flex-1 rounded-[var(--radius-card)] border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
            backgroundColor: "var(--color-surface)",
          }}
        />
        <Button type="submit" variant="secondary" disabled={!note.trim()}>
          {t("edit_add_note")}
        </Button>
      </form>
    </div>
  );
}
