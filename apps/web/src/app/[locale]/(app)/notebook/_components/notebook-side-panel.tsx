"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type {
  ExamSubjectDto,
  ExamTopicDto,
  NotebookEntryDto,
  NotebookPaper,
  VisionBoardTextItem,
  VisionSticker,
} from "@mentor/types";
import { NOTEBOOK_PAPERS, VISION_STICKERS, VISION_TEXT_FONTS } from "@mentor/types";
import { STICKER_ART } from "@/components/vision-board/board-stickers";
import { FONT_DISPLAY_NAMES, FONT_STACKS } from "@/components/vision-board/board-item-view";
import { PAPERS } from "@/components/notebook/notebook-surface";
import { NotebookAddPanel } from "./notebook-add-panel";

/**
 * The note's own plate colours. A short, local copy of the vision board's `PLATE_COLORS` rather
 * than an import: that array lives under the board route's own `_components`, private to that
 * route by the same underscore convention this file's own directory uses, and the shared,
 * cross-route home for board pieces (`@/components/vision-board/*`) is where `FONT_STACKS` and
 * `STICKER_ART` already live — this list just never got promoted there.
 */
const NOTE_PLATE_COLORS = [
  "#111111",
  "#ffffff",
  "#f3705a",
  "#55acee",
  "#bea1fe",
  "#2e7d54",
  "#ffc700",
  "#d6dbfd",
] as const;

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
 *
 * "text", by contrast, has no add affordance of its own — the rail's "Not" action already covers
 * that. It only ever shows the vision board's own font/size/plate/spacing/rotation controls for
 * whichever note is currently selected, opened automatically the same way the board opens its
 * "Metin" category on selecting a text item (`notebook-shell.tsx`'s `handleSelect`).
 */
export type NotebookPanelCategory = "add" | "sticker" | "paper" | "text";

export interface NotebookSidePanelProps {
  category: NotebookPanelCategory;
  paper: NotebookPaper;
  exam: { id: string; subjects: ExamSubjectDto[]; topics: ExamTopicDto[] } | null;
  /** The focused page's selected note, when there is one — drives the "text" category's controls. */
  selectedText: VisionBoardTextItem | null;
  onCreated: (entry: NotebookEntryDto, aspect: number | null) => void;
  onAddSticker: (asset: VisionSticker) => void;
  onSetPaper: (paper: NotebookPaper) => void;
  onPatchText: (patch: Partial<VisionBoardTextItem>) => void;
  onCheckpoint: () => void;
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
  selectedText,
  onCreated,
  onAddSticker,
  onSetPaper,
  onPatchText,
  onCheckpoint,
  onCollapse,
}: NotebookSidePanelProps) {
  const t = useTranslations("notebook");
  // Sticker names — and the text panel's field labels/font names/color names — are already fully
  // translated under the vision board's own namespace; duplicating them into `notebook.*` would
  // just be a second copy to keep in sync by hand.
  const stickerNames = useTranslations("vision.board");
  const boardT = useTranslations("vision.board");

  if (category === "text") {
    return (
      <Panel>
        {selectedText ? (
          <>
            <Field label={boardT("font")}>
              <div className="flex flex-col gap-1">
                {VISION_TEXT_FONTS.map((font) => (
                  <Pill
                    key={font}
                    active={selectedText.font === font}
                    label={FONT_DISPLAY_NAMES[font]}
                    fontFamily={FONT_STACKS[font]}
                    onClick={() => onPatchText({ font })}
                  />
                ))}
              </div>
            </Field>
            <Field label={boardT("size")}>
              <Range
                min={12}
                max={160}
                value={selectedText.size}
                label={boardT("size")}
                unit="px"
                onCommit={onCheckpoint}
                onChange={(size) => onPatchText({ size })}
              />
            </Field>
            <Field label={boardT("plate")}>
              <Row>
                {NOTE_PLATE_COLORS.map((color) => (
                  <Swatch
                    key={color}
                    color={color}
                    label={boardT("plate")}
                    active={selectedText.background?.color === color}
                    onClick={() =>
                      onPatchText({
                        background:
                          selectedText.background?.color === color
                            ? null
                            : selectedText.background
                              ? { ...selectedText.background, color }
                              : { color, opacity: 1, padding: 24, radius: 8 },
                      })
                    }
                  />
                ))}
              </Row>
            </Field>
            <Field label={boardT("line_height")}>
              <Range
                min={0.8}
                max={3}
                step={0.1}
                value={selectedText.lineHeight}
                label={boardT("line_height")}
                decimals={1}
                onCommit={onCheckpoint}
                onChange={(lineHeight) => onPatchText({ lineHeight })}
              />
            </Field>
            <Field label={boardT("letter_spacing")}>
              <Range
                min={-10}
                max={40}
                value={selectedText.letterSpacing}
                label={boardT("letter_spacing")}
                unit="px"
                onCommit={onCheckpoint}
                onChange={(letterSpacing) => onPatchText({ letterSpacing })}
              />
            </Field>
            <Field label={boardT("rotation")}>
              <Range
                min={-180}
                max={180}
                value={selectedText.rotation}
                label={boardT("rotation")}
                unit="°"
                onCommit={onCheckpoint}
                onChange={(rotation) => onPatchText({ rotation })}
              />
            </Field>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("text_panel_empty")}
          </p>
        )}
      </Panel>
    );
  }

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

/*
 * `Field`/`Row`/`Pill`/`Range`/`Swatch` below mirror the vision board's own `board-side-panel.tsx`
 * implementations verbatim (same markup, same CSS-variable styling) — the smaller, purely
 * presentational half of that file that carries no board-specific state. Sharing them outright
 * would mean lifting them out of a route's own `_components`, same story as `NOTE_PLATE_COLORS`
 * above; duplicating ~80 lines of styling-only helpers reads better than that cross-route reach.
 */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--color-secondary)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1">{children}</div>;
}

function Pill({
  active,
  label,
  fontFamily,
  onClick,
}: {
  active?: boolean;
  label: string;
  /** Renders the pill's own label in the font it represents — a live preview, not just a name. */
  fontFamily?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="min-h-9 rounded-full px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{
        backgroundColor: active ? "var(--color-main)" : "var(--color-surface)",
        color: active ? "#ffffff" : "var(--color-body)",
        fontFamily,
      }}
    >
      {label}
    </button>
  );
}

/** No name tooltip, unlike the board's own `Swatch` — that popup reads the board's colour-name
 *  translations, and eight plate colours don't need naming to be recognisable by eye. */
function Swatch({
  color,
  label,
  active,
  onClick,
}: {
  color: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      <span
        className="block h-5 w-5 rounded-full"
        style={{
          backgroundColor: color,
          outline: active ? "2px solid var(--color-accent)" : "1px solid rgba(0,0,0,0.12)",
          outlineOffset: "2px",
        }}
      />
    </button>
  );
}

function Range({
  min,
  max,
  step = 1,
  value,
  label,
  unit = "",
  decimals = 0,
  onChange,
  onCommit,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  label: string;
  /** Appended to the value chip — "px", "°", or left blank for a plain ratio. */
  unit?: string;
  decimals?: number;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onCommit}
        onKeyDown={onCommit}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mentor-range h-1.5 w-full flex-1"
        style={{
          background: `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-surface-container) ${pct}%)`,
        }}
      />
      <span
        className="flex h-9 min-w-16 shrink-0 items-center justify-center gap-0.5 rounded-[var(--radius-card)] border px-1.5"
        style={{ borderColor: "rgba(17, 17, 17, 0.12)" }}
      >
        <input
          type="number"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value.toFixed(decimals)}
          onFocus={onCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isNaN(next)) return;
            onChange(Math.min(max, Math.max(min, next)));
          }}
          className="w-full min-w-0 bg-transparent text-center text-xs font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          style={{ color: "var(--color-body)" }}
        />
        {unit ? (
          <span className="shrink-0 text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}
