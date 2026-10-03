"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type {
  ExamSubjectDto,
  ExamTopicDto,
  NotebookCoverDoc,
  NotebookEntryDto,
  NotebookPaper,
  VisionBoardTextItem,
  VisionSticker,
} from "@mentor/types";
import {
  NOTEBOOK_COVER_COLORS,
  NOTEBOOK_COVER_MATERIALS,
  NOTEBOOK_COVER_TITLE_MAX_LENGTH,
  NOTEBOOK_PAPERS,
  VISION_STICKERS,
  VISION_TEXT_FONTS,
} from "@mentor/types";
import { RangeSlider } from "@/components/range-slider";
import { STICKER_ART } from "@/components/vision-board/board-stickers";
import {
  FONT_DISPLAY_NAMES,
  FONT_STACKS,
} from "@/components/vision-board/board-item-view";
import {
  COVER_COLORS,
  COVER_MATERIALS,
  DEFAULT_COVER,
} from "@/components/notebook/notebook-surface";
import { NotebookAddPanel } from "./notebook-add-panel";
import { NotebookIndexPanel } from "./notebook-index-panel";
import type { NotebookIndexFilters } from "@/lib/notebook-index-query";

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
 *
 * "draw", likewise, has no body here — but for the opposite reason to "text". Text has controls
 * that simply live elsewhere in the rail; draw is a *mode*, and its controls are the pen tray that
 * floats over the notebook itself (`notebook-ink-toolbar.tsx`). Putting them in this panel would
 * have meant reaching across the page you are drawing on to change pens, and would have cost the
 * notebook the panel's width at exactly the moment it needs to be as large as possible.
 */
export type NotebookPanelCategory =
  | "add"
  | "index"
  | "sticker"
  | "paper"
  | "text"
  | "draw";

export interface NotebookSidePanelProps {
  category: NotebookPanelCategory;
  paper: NotebookPaper;
  /** The book's cover, read from page zero. Null while that page is still loading. */
  cover: NotebookCoverDoc | null;
  onCover: (next: NotebookCoverDoc) => void;
  exam: {
    id: string;
    subjects: ExamSubjectDto[];
    topics: ExamTopicDto[];
  } | null;
  /** Taxonomy of the exam named by an analysis deep link; adding still uses the active exam. */
  indexExam?: {
    id: string;
    subjects: ExamSubjectDto[];
    topics: ExamTopicDto[];
  } | null;
  /** The focused page's selected note, when there is one — drives the "text" category's controls. */
  selectedText: VisionBoardTextItem | null;
  onCreated: (entry: NotebookEntryDto, aspect: number | null) => void;
  onAddSticker: (asset: VisionSticker) => void;
  /** Set when the student arrived from a just-saved mock exam; stamped onto entries they file. */
  mockExamId: string | null;
  /** Entries already arranged on one of the open pages — the index will not offer to place them. */
  placedEntryIds: ReadonlySet<string>;
  /** Bumped when an entry is edited or deleted elsewhere, so the index reloads instead of lying. */
  indexRefreshKey: number;
  initialIndexFilters?: NotebookIndexFilters;
  indexFilterNames?: { exam?: string; mockExam?: string };
  onOpenEntry: (entry: NotebookEntryDto) => void;
  onPlaceEntry: (entry: NotebookEntryDto) => void;
  /** Study a chosen set now, whatever their schedule says — see `NotebookIndexPanel`. */
  onStudyEntries: (entries: NotebookEntryDto[]) => void;
  onSetPaper: (paper: NotebookPaper) => void;
  onPatchText: (patch: Partial<VisionBoardTextItem>) => void;
  onCheckpoint: () => void;
  /** "Vazgeç" on the add form. */
  onCollapse: () => void;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mentor-scrollarea h-full min-h-0 overflow-y-auto">
      <div className="flex flex-col gap-4 px-4 pb-4 pt-1">{children}</div>
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
  cover,
  onCover,
  exam,
  indexExam,
  selectedText,
  onCreated,
  onAddSticker,
  mockExamId,
  placedEntryIds,
  indexRefreshKey,
  initialIndexFilters,
  indexFilterNames,
  onOpenEntry,
  onPlaceEntry,
  onStudyEntries,
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
              <div className="grid grid-cols-2 gap-1">
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
              <RangeSlider
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
              <RangeSlider
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
              <RangeSlider
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
              <RangeSlider
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
          mockExamId={mockExamId}
            subjects={exam.subjects}
            topics={exam.topics}
          onCreated={onCreated}
          onCancel={onCollapse}
        />
      </Panel>
    );
  }

  if (category === "index") {
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
          <NotebookIndexPanel
            subjects={(indexExam ?? exam).subjects}
            topics={(indexExam ?? exam).topics}
          initialFilters={initialIndexFilters}
          filterNames={indexFilterNames}
          placedEntryIds={placedEntryIds}
          refreshKey={indexRefreshKey}
          onOpen={onOpenEntry}
          onPlace={onPlaceEntry}
          onStudy={onStudyEntries}
        />
      </Panel>
    );
  }

  if (category === "sticker") {
    return (
      <StickerPanel
        onAddSticker={onAddSticker}
        stickerName={(asset) =>
          stickerNames(
            `sticker_${asset.startsWith("MASCOT_") ? "mascot" : asset.toLowerCase()}`,
          )
        }
      />
    );
  }

  return (
    <Panel>
      <Field label={t("paper_page_section")}>
        <div className="grid grid-cols-2 gap-2">
          {NOTEBOOK_PAPERS.map((value) => {
            const active = value === paper;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => onSetPaper(value)}
                className="flex cursor-pointer flex-col gap-1.5 rounded-[var(--radius-card)] border p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{
                  borderColor: active
                    ? "var(--color-accent)"
                    : "color-mix(in srgb, var(--color-main) 12%, transparent)",
                  backgroundColor: active
                    ? "var(--color-accent-soft)"
                    : "var(--color-surface)",
                }}
              >
                <span
                  aria-hidden
                  className="h-14 w-full rounded"
                  style={{
                    backgroundColor: "var(--notebook-paper)",
                    border:
                      "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
                    ...PAPER_PREVIEWS[value],
                  }}
                />
                <span
                  className="px-1 text-sm font-semibold"
                  style={{ color: "var(--color-main)" }}
                >
                  {t(`paper.${value}`)}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <CoverSection cover={cover} onCover={onCover} />
    </Panel>
  );
}

/**
 * Paper swatches at preview scale.
 *
 * Not `PAPERS` itself: the page's patterns are sized in `cqw` against the page's own container, and a
 * swatch in this panel has no such container, so the units fell back to the viewport and a 36px
 * swatch held at most one ruling. Every paper then looked like "Düz". Same colours and the same
 * three patterns, just a fixed step small enough to show several lines in the tile.
 */
const PREVIEW_STEP = "8px";
const PAPER_PREVIEWS: Record<NotebookPaper, CSSProperties> = {
  ruled: {
    backgroundImage: `repeating-linear-gradient(180deg, transparent 0 calc(${PREVIEW_STEP} - 1px), var(--notebook-rule) calc(${PREVIEW_STEP} - 1px) ${PREVIEW_STEP})`,
  },
  grid: {
    backgroundImage: `repeating-linear-gradient(180deg, transparent 0 calc(${PREVIEW_STEP} - 1px), var(--notebook-rule) calc(${PREVIEW_STEP} - 1px) ${PREVIEW_STEP}), repeating-linear-gradient(90deg, transparent 0 calc(${PREVIEW_STEP} - 1px), var(--notebook-rule) calc(${PREVIEW_STEP} - 1px) ${PREVIEW_STEP})`,
  },
  dotted: {
    backgroundImage:
      "radial-gradient(var(--notebook-rule) 1px, transparent 1.4px)",
    backgroundSize: `${PREVIEW_STEP} ${PREVIEW_STEP}`,
  },
  plain: {},
};

/**
 * The catalogue split three ways, in the order the vision board ships it. One flat grid of 77 put
 * Puhu, a check mark and a strip of washi tape side by side, and the student had to scan all of it
 * to find any one kind. Grouped by what the sticker *is*, not by where its art came from.
 */
type StickerGroup = "puhu" | "shape" | "decor";
const STICKER_GROUPS: readonly StickerGroup[] = ["puhu", "shape", "decor"];
const SHAPE_STICKERS: ReadonlySet<VisionSticker> = new Set<VisionSticker>([
  "STAR",
  "HEART",
  "SPARKLE",
  "ARROW",
  "PIN",
  "TARGET",
  "FLAG",
  "CHECK",
  "TROPHY",
  "ROCKET",
  "GRADCAP",
  "CROWN",
  "LIGHTNING",
]);
function stickerGroup(asset: VisionSticker): StickerGroup {
  if (asset.startsWith("MASCOT_") || asset.startsWith("PUHU_")) return "puhu";
  return SHAPE_STICKERS.has(asset) ? "shape" : "decor";
}

function StickerPanel({
  onAddSticker,
  stickerName,
}: {
  onAddSticker: (asset: VisionSticker) => void;
  stickerName: (asset: VisionSticker) => string;
}) {
  const t = useTranslations("notebook");
  const [group, setGroup] = useState<StickerGroup>("puhu");

  return (
    <Panel>
      <div
        role="tablist"
        aria-label={t("sidebar_sticker")}
        className="grid grid-cols-3 gap-1 rounded-full p-1"
        style={{ backgroundColor: "var(--color-surface-container)" }}
      >
        {STICKER_GROUPS.map((value) => {
          const active = value === group;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setGroup(value)}
              className="min-h-9 cursor-pointer rounded-full text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{
                backgroundColor: active ? "var(--color-surface)" : "transparent",
                color: active ? "var(--color-main)" : "var(--color-secondary)",
                boxShadow: active ? "var(--shadow-card)" : undefined,
              }}
            >
              {t(`sticker_group.${value}`)}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="grid grid-cols-6 gap-1">
        {VISION_STICKERS.filter((asset) => stickerGroup(asset) === group).map(
          (asset) => (
            <button
              key={asset}
              type="button"
              onClick={() => onAddSticker(asset)}
              aria-label={stickerName(asset)}
              className="grid aspect-square w-full cursor-pointer place-items-center rounded-[var(--radius-card)] outline-none hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <StickerPreview asset={asset} />
            </button>
          ),
        )}
      </div>
    </Panel>
  );
}

/**
 * The book's own cover: colour, finish, and what is written on the label.
 *
 * In the paper panel rather than a rail item of its own. Both are "what this notebook is made of",
 * and a fifth rail button for a setting somebody touches once would cost every student a permanent
 * inch of the rail to save one of them a scroll.
 *
 * Every swatch is drawn with the recipe the cover itself uses (`COVER_COLORS`, `COVER_MATERIALS`),
 * so a preview cannot drift from the thing it previews.
 */
function CoverSection({
  cover,
  onCover,
}: {
  cover: NotebookCoverDoc | null;
  onCover: (next: NotebookCoverDoc) => void;
}) {
  const t = useTranslations("notebook");
  const current = cover ?? DEFAULT_COVER;

  return (
    <div
      className="flex flex-col gap-3 pt-3"
      style={{
        borderTop:
          "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
      }}
    >
      <FieldLabel>{t("cover_section")}</FieldLabel>

      <div className="flex flex-wrap gap-2">
        {NOTEBOOK_COVER_COLORS.map((value) => {
          const active = value === current.color;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              aria-label={t(`cover_color.${value}`)}
              title={t(`cover_color.${value}`)}
              onClick={() => onCover({ ...current, color: value })}
              className="size-9 cursor-pointer rounded-full outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{
                backgroundColor: COVER_COLORS[value],
                // The ring, not a tick: a tick on a dark swatch needs its own colour rule per
                // swatch, and the ring reads at a glance across all six.
                boxShadow: active
                  ? "0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-accent)"
                  : "inset 0 0 0 1px rgba(0,0,0,0.25)",
              }}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {NOTEBOOK_COVER_MATERIALS.map((value) => {
          const active = value === current.material;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onCover({ ...current, material: value })}
              className="flex min-h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border py-1 pl-1 pr-2.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                color: "var(--color-main)",
                borderColor: active
                  ? "var(--color-accent)"
                  : "color-mix(in srgb, var(--color-main) 12%, transparent)",
                backgroundColor: active
                  ? "var(--color-accent-soft)"
                  : "var(--color-surface)",
              }}
            >
              {/* Shown in the colour that is actually selected, so the finishes are compared on the
                  cover the student is choosing them for rather than on a stand-in. */}
              <span
                aria-hidden
                className="size-7 shrink-0 rounded"
                style={{
                  backgroundColor: COVER_COLORS[current.color],
                  backgroundImage: COVER_MATERIALS[value],
                }}
              />
              {t(`cover_material.${value}`)}
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1">
        <FieldLabel>{t("cover_title_label")}</FieldLabel>
        {/* Blank is a real answer, not an empty field: clearing it puts the app's own name back on
            the cover rather than leaving the book untitled. */}
        <input
          type="text"
          value={current.title ?? ""}
          maxLength={NOTEBOOK_COVER_TITLE_MAX_LENGTH}
          placeholder={t("cover_title")}
          onChange={(event) =>
            onCover({ ...current, title: event.target.value || null })
          }
          className="min-h-11 rounded-[var(--radius-card)] border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            color: "var(--color-main)",
            backgroundColor: "var(--color-surface)",
            borderColor:
              "color-mix(in srgb, var(--color-main) 12%, transparent)",
          }}
        />
      </label>
    </div>
  );
}

/*
 * `Field`/`Row`/`Pill`/`Range`/`Swatch` below mirror the vision board's own `board-side-panel.tsx`
 * implementations verbatim (same markup, same CSS-variable styling) — the smaller, purely
 * presentational half of that file that carries no board-specific state. Sharing them outright
 * would mean lifting them out of a route's own `_components`, same story as `NOTE_PLATE_COLORS`
 * above; duplicating ~80 lines of styling-only helpers reads better than that cross-route reach.
 */

/**
 * The one section-label style every panel body uses. The text panel used to shout its labels in
 * 10px capitals while the paper panel whispered in sentence case; one style now, sentence case.
 */
export function FieldLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span
      id={id}
      className="text-xs font-bold"
      style={{ color: "var(--color-secondary)" }}
    >
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
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
      className="min-h-9 rounded-full border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{
        backgroundColor: active ? "var(--play-selected)" : "var(--color-surface)",
        color: active ? "var(--play-selected-ink)" : "var(--color-body)",
        borderColor: active ? "var(--play-cta)" : "transparent",
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
          outline: active
            ? "2px solid var(--color-accent)"
            : "1px solid color-mix(in srgb, var(--color-main) 12%, transparent)",
          outlineOffset: "2px",
        }}
      />
    </button>
  );
}
