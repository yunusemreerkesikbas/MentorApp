"use client";

import { useTranslations } from "next-intl";
import type {
  ExamSubjectDto,
  ExamTopicDto,
  NotebookEntryDto,
  NotebookPaper,
  VisionSticker,
} from "@mentor/types";
import { NOTEBOOK_PAPERS, VISION_STICKERS } from "@mentor/types";
import { STICKER_ART } from "@/components/vision-board/board-stickers";
import { PAPERS } from "@/components/notebook/notebook-surface";
import { NotebookAddPanel } from "./notebook-add-panel";

/**
 * Category detail bodies for the notebook's rail, mirroring the vision board's
 * `board-side-panel.tsx`: the rail decides WHAT you're doing, this holds the controls for it.
 *
 * The sticker grid is the vision board's own full set, not a curated shortlist — a shortlist was
 * tried first and second-guessed the vision board's own catalogue for no real reason; if all 68 are
 * good enough to decorate a goal board with, they are good enough here too.
 *
 * Note-adding is deliberately NOT a category here: it is a rail *action* (add + start typing
 * in-place on the page), the same shape as the vision board's `addText`, so it has no panel body —
 * see `notebook-shell.tsx`.
 */
export type NotebookPanelCategory = "add" | "sticker" | "paper";

export interface NotebookSidePanelProps {
  category: NotebookPanelCategory;
  paper: NotebookPaper;
  exam: { id: string; subjects: ExamSubjectDto[]; topics: ExamTopicDto[] } | null;
  onCreated: (entry: NotebookEntryDto) => void;
  onAddSticker: (asset: VisionSticker) => void;
  onSetPaper: (paper: NotebookPaper) => void;
  /** "Vazgeç" on the add form. */
  onCollapse: () => void;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mentor-scrollarea h-full min-h-0 overflow-y-auto">
      <div className="flex flex-col gap-3 px-3 pb-3 pt-4">{children}</div>
    </div>
  );
}

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

export function NotebookSidePanel({
  category,
  paper,
  exam,
  onCreated,
  onAddSticker,
  onSetPaper,
  onCollapse,
}: NotebookSidePanelProps) {
  const t = useTranslations("notebook");
  // Sticker names are already fully translated for every one of the 68 assets under the vision
  // board's own namespace — duplicating them into `notebook.*` would just be a second copy to keep
  // in sync by hand.
  const stickerNames = useTranslations("vision.board");

  if (category === "add") {
    if (!exam) {
      return (
        <Panel>
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("add_requires_exam")}
          </p>
        </Panel>
      );
    }
    return (
      <Panel>
        <NotebookAddPanel
          examId={exam.id}
          subjects={exam.subjects}
          topics={exam.topics}
          onCreated={onCreated}
          onCancel={onCollapse}
        />
      </Panel>
    );
  }

  if (category === "sticker") {
    return (
      <Panel>
        <div className="flex flex-wrap gap-1">
          {VISION_STICKERS.map((asset) => (
            <button
              key={asset}
              type="button"
              onClick={() => onAddSticker(asset)}
              aria-label={stickerNames(
                `sticker_${asset.startsWith("MASCOT_") ? "mascot" : asset.toLowerCase()}`,
              )}
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[var(--radius-card)] outline-none hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <StickerPreview asset={asset} />
            </button>
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex flex-col gap-2">
        {NOTEBOOK_PAPERS.map((value) => {
          const active = value === paper;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onSetPaper(value)}
              className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-card)] border p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                borderColor: active
                  ? "var(--color-accent)"
                  : "color-mix(in srgb, var(--color-main) 12%, transparent)",
                backgroundColor: active
                  ? "var(--color-accent-soft)"
                  : "var(--color-surface)",
              }}
            >
              {/* A live swatch, not just a name — the same styles the page itself renders with. */}
              <span
                aria-hidden
                className="size-9 shrink-0 rounded"
                style={{
                  backgroundColor: "var(--notebook-paper)",
                  border: "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
                  ...PAPERS[value],
                }}
              />
              <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
                {t(`paper.${value}`)}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
