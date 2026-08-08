"use client";

import type { ReactNode } from "react";
import {
  VISION_BOARD_FRAMES,
  VISION_BOARD_TEXTURES,
  VISION_IMAGE_FRAMES,
  VISION_STICKERS,
  VISION_TEXT_FONTS,
  type VisionBoardDoc,
  type VisionBoardItem,
} from "@mentor/types";
import { useTranslations } from "next-intl";
import { STICKER_ART } from "@/components/vision-board/board-stickers";
import { BOARD_COLORS, PLATE_COLORS } from "./board-palettes";
import { BOARD_TEMPLATE_IDS, type BoardTemplateId } from "./board-templates";

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
  uploading?: boolean;
  onAddText: () => void;
  onUploadImage: () => void;
  onAddSticker: (asset: (typeof VISION_STICKERS)[number]) => void;
  onApplyTemplate: (id: BoardTemplateId) => void;
  onPatch: (patch: Partial<VisionBoardItem>, transient?: boolean) => void;
  onCheckpoint: () => void;
  onSetFrame: (frame: VisionBoardDoc["frame"]) => void;
  onSetBackground: (background: VisionBoardDoc["background"]) => void;
  onOpenBoardColor: () => void;
}

export function BoardSidePanel({
  category,
  doc,
  selected,
  uploading,
  onAddText,
  onUploadImage,
  onAddSticker,
  onApplyTemplate,
  onPatch,
  onCheckpoint,
  onSetFrame,
  onSetBackground,
  onOpenBoardColor,
}: BoardSidePanelProps) {
  const t = useTranslations("vision.board");

  if (category === "board") {
    return (
      <Panel>
        <Field label={t("board_frame")}>
          <Row>
            {VISION_BOARD_FRAMES.map((frame) => (
              <Pill
                key={frame}
                active={doc.frame === frame}
                label={t(`frame_${frame}`)}
                onClick={() => onSetFrame(frame)}
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
            <button
              type="button"
              onClick={onOpenBoardColor}
              className="min-h-9 rounded-full px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                backgroundColor: "var(--color-surface)",
                color: "var(--color-body)",
              }}
            >
              {t("color_more")}
            </button>
          </Row>
        </Field>
      </Panel>
    );
  }

  if (category === "image") {
    return (
      <Panel>
        <PrimaryAction
          label={uploading ? t("image_uploading") : t("add_image_cta")}
          busy={uploading}
          onClick={onUploadImage}
        />
        {selected?.kind === "image" ? (
          <>
            <Field label={t("image_frame")}>
              <Row>
                {VISION_IMAGE_FRAMES.map((frame) => (
                  <Pill
                    key={frame}
                    active={selected.frame === frame}
                    label={t(`image_frame_${frame}`)}
                    onClick={() => onPatch({ frame })}
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
                onCommit={onCheckpoint}
                onChange={(rotation) => onPatch({ rotation }, true)}
              />
            </Field>
            <Field label={t("opacity")}>
              <Range
                min={0}
                max={1}
                step={0.05}
                value={selected.opacity}
                label={t("opacity")}
                onCommit={onCheckpoint}
                onChange={(opacity) => onPatch({ opacity }, true)}
              />
            </Field>
          </>
        ) : (
          <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
            {t("image_panel_hint")}
          </p>
        )}
      </Panel>
    );
  }

  if (category === "text") {
    return (
      <Panel>
        <PrimaryAction label={t("add_text_cta")} onClick={onAddText} />
        {selected?.kind === "text" ? (
          <>
            <Field label={t("text_content")}>
              <textarea
                value={selected.text}
                maxLength={280}
                rows={3}
                onFocus={onCheckpoint}
                onChange={(event) =>
                  onPatch({ text: event.target.value, source: undefined }, true)
                }
                className="w-full rounded-[var(--radius-card)] p-2 text-sm"
                style={{
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-body)",
                }}
              />
            </Field>
            <Field label={t("font")}>
              <Row>
                {VISION_TEXT_FONTS.map((font) => (
                  <Pill
                    key={font}
                    active={selected.font === font}
                    label={t(`font_${font}`)}
                    onClick={() => onPatch({ font })}
                  />
                ))}
              </Row>
            </Field>
            <Field label={t("size")}>
              <Range
                min={12}
                max={160}
                value={selected.size}
                label={t("size")}
                onCommit={onCheckpoint}
                onChange={(size) => onPatch({ size }, true)}
              />
            </Field>
            <Field label={t("plate")}>
              <Row>
                <Pill
                  active={selected.background != null}
                  label={t("plate_toggle")}
                  onClick={() =>
                    onPatch({
                      background: selected.background
                        ? null
                        : { color: "#111111", opacity: 1, padding: 24, radius: 8 },
                    })
                  }
                />
              </Row>
              {selected.background ? (
                <Row>
                  {PLATE_COLORS.map((color) => (
                    <Swatch
                      key={color}
                      color={color}
                      label={t("plate")}
                      active={selected.background?.color === color}
                      onClick={() =>
                        onPatch({ background: { ...selected.background!, color } })
                      }
                    />
                  ))}
                </Row>
              ) : null}
            </Field>
            <Field label={t("line_height")}>
              <Range
                min={0.8}
                max={3}
                step={0.1}
                value={selected.lineHeight}
                label={t("line_height")}
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
                onCommit={onCheckpoint}
                onChange={(rotation) => onPatch({ rotation }, true)}
              />
            </Field>
          </>
        ) : (
          <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
            {t("text_panel_hint")}
          </p>
        )}
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
                    <path d={art.path} fill={art.fill} />
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
      <div className="flex flex-col gap-1">
        {BOARD_TEMPLATE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onApplyTemplate(id)}
            className="min-h-11 rounded-[var(--radius-card)] px-3 text-left text-sm font-semibold hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-main)" }}
          >
            {t(`template_${id}`)}
          </button>
        ))}
      </div>
    </Panel>
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
  onClick,
}: {
  active?: boolean;
  label: string;
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
      }}
    >
      {label}
    </button>
  );
}

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
      aria-label={`${label}: ${color}`}
      aria-pressed={active}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
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
  onChange,
  onCommit,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  label: string;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return (
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
      className="h-9 w-full accent-[var(--color-accent)]"
    />
  );
}
