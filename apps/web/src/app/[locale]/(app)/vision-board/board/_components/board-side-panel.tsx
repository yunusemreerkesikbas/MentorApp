"use client";

import type { ReactNode } from "react";
import {
  VISION_BOARD_CANVAS,
  VISION_BOARD_FRAMES,
  VISION_BOARD_TEXTURES,
  VISION_IMAGE_FRAMES,
  VISION_STICKERS,
  VISION_TEXT_FONTS,
  type VisionBoardDoc,
  type VisionBoardItem,
} from "@mentor/types";
import { useTranslations } from "next-intl";
import { ProgressBar } from "@mentor/ui";
import { FONT_DISPLAY_NAMES, FONT_STACKS } from "@/components/vision-board/board-item-view";
import { STICKER_ART } from "@/components/vision-board/board-stickers";
import { BOARD_COLORS, PLATE_COLORS } from "./board-palettes";
import { Swatch } from "./board-swatch";
import {
  BOARD_TEMPLATE_IDS,
  TEMPLATE_HEADLINES,
  templateSlots,
  type BoardTemplateId,
} from "./board-templates";

/**
 * Category detail bodies for the Canva-style editor rail.
 * Quick actions (bold, rotate, layers…) live on the contextual toolbar — this panel holds
 * the denser controls that need vertical space.
 */

export type BoardPanelCategory = "image" | "text" | "sticker" | "template" | "board";

export interface BoardSidePanelProps {
  category: BoardPanelCategory;
  doc: VisionBoardDoc;
  selected: VisionBoardItem | null;
  selectedId: string | null;
  uploadProgress?: { done: number; total: number } | null;
  onAddText: () => void;
  onUploadImage: () => void;
  onAddSticker: (asset: (typeof VISION_STICKERS)[number]) => void;
  onSelectItem: (id: string) => void;
  onApplyTemplate: (id: BoardTemplateId) => void;
  onPatch: (patch: Partial<VisionBoardItem>, transient?: boolean) => void;
  onCheckpoint: () => void;
  onSetFrame: (frame: VisionBoardDoc["frame"]) => void;
  onSetBackground: (background: VisionBoardDoc["background"]) => void;
}

export function BoardSidePanel({
  category,
  doc,
  selected,
  selectedId,
  uploadProgress,
  onAddText,
  onUploadImage,
  onAddSticker,
  onSelectItem,
  onApplyTemplate,
  onPatch,
  onCheckpoint,
  onSetFrame,
  onSetBackground,
}: BoardSidePanelProps) {
  const t = useTranslations("vision.board");

  if (category === "board") {
    return (
      <Panel>
        <Field label={t("board_frame")}>
          <Row>
            {VISION_BOARD_FRAMES.filter((frame) => frame !== "none").map((frame) => (
              <Pill
                key={frame}
                active={doc.frame === frame}
                label={t(`frame_${frame}`)}
                onClick={() => onSetFrame(doc.frame === frame ? "none" : frame)}
              />
            ))}
          </Row>
        </Field>
        <Field label={t("background")}>
          <Row>
            {VISION_BOARD_TEXTURES.map((texture) => (
              <Pill
                key={texture}
                active={doc.background.kind === "texture" && doc.background.value === texture}
                label={t(`texture_${texture}`)}
                onClick={() => onSetBackground({ kind: "texture", value: texture })}
              />
            ))}
          </Row>
          <Row>
            {BOARD_COLORS.map((color) => (
              <Swatch
                key={color}
                color={color}
                label={t("background")}
                active={doc.background.kind === "color" && doc.background.value === color}
                onClick={() => onSetBackground({ kind: "color", value: color })}
              />
            ))}
          </Row>
        </Field>
      </Panel>
    );
  }

  if (category === "image") {
    return (
      <Panel>
        <PrimaryAction
          label={uploadProgress ? t("image_uploading") : t("add_image_cta")}
          busy={uploadProgress != null}
          onClick={onUploadImage}
        />
        {uploadProgress && uploadProgress.total > 1 ? (
          <ProgressBar value={(uploadProgress.done / uploadProgress.total) * 100} />
        ) : null}
        {doc.items.some((item) => item.kind === "image") ? (
          <div className="grid grid-cols-2 gap-2">
            {doc.items
              .filter((item) => item.kind === "image")
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={t("select_image")}
                  aria-pressed={item.id === selectedId}
                  onClick={() => onSelectItem(item.id)}
                  className="w-full overflow-hidden rounded-[var(--radius-card)] focus-visible:outline-none"
                  style={{
                    // Box matches the photo's own placed proportions — a portrait shot gets a
                    // portrait thumbnail, not a square crop guessing at what matters in it.
                    aspectRatio: `${item.width} / ${item.height}`,
                    outline:
                      item.id === selectedId
                        ? "2px solid var(--color-focus-ring)"
                        : "1px solid rgba(0,0,0,0.08)",
                    outlineOffset: "1px",
                  }}
                >
                  {item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small panel thumbnail, not an export target
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ backgroundColor: "var(--color-surface-container)" }}
                    />
                  )}
                </button>
              ))}
          </div>
        ) : null}
        {selected?.kind === "image" ? (
          <>
            <Field label={t("image_frame")}>
              <Row>
                {VISION_IMAGE_FRAMES.filter((frame) => frame !== "none").map((frame) => (
                  <Pill
                    key={frame}
                    active={selected.frame === frame}
                    label={t(`image_frame_${frame}`)}
                    onClick={() => onPatch({ frame: selected.frame === frame ? "none" : frame })}
                  />
                ))}
              </Row>
            </Field>
            <Field label={t("rotation")}>
              <Range
                min={-180}
                max={180}
                value={selected.rotation}
                label={t("rotation")}
                unit="°"
                onCommit={onCheckpoint}
                onChange={(rotation) => onPatch({ rotation }, true)}
              />
            </Field>
            <Field label={t("opacity")}>
              <Range
                min={0}
                max={100}
                step={5}
                value={selected.opacity * 100}
                label={t("opacity")}
                unit="%"
                onCommit={onCheckpoint}
                onChange={(opacity) => onPatch({ opacity: opacity / 100 }, true)}
              />
            </Field>
          </>
        ) : null}
      </Panel>
    );
  }

  if (category === "text") {
    return (
      <Panel>
        <PrimaryAction label={t("add_text_cta")} onClick={onAddText} />
        {selected?.kind === "text" ? (
          <>
            <Field label={t("font")}>
              <div className="flex flex-col gap-1">
                {VISION_TEXT_FONTS.map((font) => (
                  <Pill
                    key={font}
                    active={selected.font === font}
                    label={FONT_DISPLAY_NAMES[font]}
                    fontFamily={FONT_STACKS[font]}
                    onClick={() => onPatch({ font })}
                  />
                ))}
              </div>
            </Field>
            <Field label={t("size")}>
              <Range
                min={12}
                max={160}
                value={selected.size}
                label={t("size")}
                unit="px"
                onCommit={onCheckpoint}
                onChange={(size) => onPatch({ size }, true)}
              />
            </Field>
            <Field label={t("plate")}>
              <Row>
                {PLATE_COLORS.map((color) => (
                  <Swatch
                    key={color}
                    color={color}
                    label={t("plate")}
                    active={selected.background?.color === color}
                    onClick={() =>
                      onPatch({
                        background:
                          selected.background?.color === color
                            ? null
                            : selected.background
                              ? { ...selected.background, color }
                              : { color, opacity: 1, padding: 24, radius: 8 },
                      })
                    }
                  />
                ))}
              </Row>
            </Field>
            <Field label={t("line_height")}>
              <Range
                min={0.8}
                max={3}
                step={0.1}
                value={selected.lineHeight}
                label={t("line_height")}
                decimals={1}
                onCommit={onCheckpoint}
                onChange={(lineHeight) => onPatch({ lineHeight }, true)}
              />
            </Field>
            <Field label={t("letter_spacing")}>
              <Range
                min={-10}
                max={40}
                value={selected.letterSpacing}
                label={t("letter_spacing")}
                unit="px"
                onCommit={onCheckpoint}
                onChange={(letterSpacing) => onPatch({ letterSpacing }, true)}
              />
            </Field>
            <Field label={t("rotation")}>
              <Range
                min={-180}
                max={180}
                value={selected.rotation}
                label={t("rotation")}
                unit="°"
                onCommit={onCheckpoint}
                onChange={(rotation) => onPatch({ rotation }, true)}
              />
            </Field>
          </>
        ) : null}
      </Panel>
    );
  }

  if (category === "sticker") {
    return (
      <Panel>
        <div className="flex flex-wrap gap-1">
          {VISION_STICKERS.map((asset) => {
            const art = STICKER_ART[asset];
            return (
              <button
                key={asset}
                type="button"
                aria-label={t(
                  `sticker_${asset.startsWith("MASCOT_") ? "mascot" : asset.toLowerCase()}`,
                )}
                onClick={() => onAddSticker(asset)}
                className="grid min-h-11 min-w-11 place-items-center rounded-[var(--radius-card)] p-1 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ backgroundColor: "var(--color-surface)" }}
              >
                {art.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- same-origin mascot PNG
                  <img src={art.src} alt="" className="h-8 w-8 object-contain" />
                ) : (
                  <svg viewBox="0 0 100 100" className="h-7 w-7" aria-hidden>
                    <path d={art.path} fill={art.fill} fillRule={art.fillRule} />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="grid grid-cols-2 gap-2">
        {BOARD_TEMPLATE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onApplyTemplate(id)}
            className="flex flex-col gap-1.5 rounded-[var(--radius-card)] p-1.5 text-left hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <TemplatePreview id={id} />
            <span className="text-xs font-semibold" style={{ color: "var(--color-main)" }}>
              {t(`template_${id}`)}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

/**
 * A schematic drawing of the template's own slot data, at board scale — not a screenshot, so it
 * can never drift from what "apply" actually does to the document.
 */
function TemplatePreview({ id }: { id: BoardTemplateId }) {
  const headline = TEMPLATE_HEADLINES[id];
  return (
    <div
      aria-hidden
      className="relative w-full overflow-hidden rounded-[6px]"
      style={{
        aspectRatio: `${VISION_BOARD_CANVAS.width} / ${VISION_BOARD_CANVAS.height}`,
        backgroundColor: "var(--color-surface-container)",
      }}
    >
      {templateSlots(id).map((slot, index) => (
        <div
          key={index}
          className="absolute rounded-[2px]"
          style={{
            left: `${(slot.x / VISION_BOARD_CANVAS.width) * 100}%`,
            top: `${(slot.y / VISION_BOARD_CANVAS.height) * 100}%`,
            width: `${(slot.width / VISION_BOARD_CANVAS.width) * 100}%`,
            height: `${(slot.height / VISION_BOARD_CANVAS.height) * 100}%`,
            transform: `rotate(${slot.rotation}deg)`,
            backgroundColor: "var(--color-progress-track)",
          }}
        />
      ))}
      <div
        className="absolute rounded-full"
        style={{
          left: "50%",
          top: `${(headline.y / VISION_BOARD_CANVAS.height) * 100}%`,
          width: "42%",
          height: `${(headline.size / VISION_BOARD_CANVAS.height) * 100}%`,
          transform: "translateX(-50%)",
          backgroundColor: "var(--color-main)",
          opacity: 0.35,
        }}
      />
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="mentor-scrollarea flex flex-col gap-3 overflow-y-auto px-3 pb-3 pt-4">
      {children}
    </div>
  );
}

function PrimaryAction({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="min-h-11 w-full rounded-[var(--radius-card)] px-3 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{ backgroundColor: "var(--color-btn)" }}
    >
      {label}
    </button>
  );
}

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
  /** Appended to the value chip — "px", "°", "%", or left blank for a plain ratio. */
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
