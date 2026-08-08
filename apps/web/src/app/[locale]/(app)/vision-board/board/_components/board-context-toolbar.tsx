"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BringToFront,
  Copy,
  Frame,
  Italic,
  RotateCw,
  SendToBack,
  Trash2,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  VISION_TEXT_ALIGNS,
  type VisionBoardItem,
  type VisionTextAlign,
} from "@mentor/types";
import { boardChromeTransition } from "./board-chrome-motion";
import type { ColorPanelTarget } from "./board-palettes";

export interface BoardContextToolbarProps {
  selected: VisionBoardItem;
  onPatch: (patch: Partial<VisionBoardItem>, transient?: boolean) => void;
  onCheckpoint: () => void;
  onLayer: (direction: "front" | "back") => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onOpenColor: (target: ColorPanelTarget) => void;
  onOpenImageFrames: () => void;
}

function normalizeRotation(degrees: number): number {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return Math.round(wrapped);
}

export function BoardContextToolbar({
  selected,
  onPatch,
  onCheckpoint,
  onLayer,
  onDuplicate,
  onRemove,
  onOpenColor,
  onOpenImageFrames,
}: BoardContextToolbarProps) {
  const t = useTranslations("vision.board");
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={boardChromeTransition}
      className="mentor-scrollarea flex w-fit max-w-full shrink-0 items-center gap-0.5 overflow-x-auto rounded-[var(--radius-card)] px-1 py-1"
      style={{
        backgroundColor: "var(--color-surface)",
        boxShadow: "var(--shadow-card)",
      }}
      role="toolbar"
      aria-label={t("context_toolbar")}
    >
      {selected.kind === "text" ? (
        <>
          <ToolBtn
            label={t("bold")}
            pressed={selected.bold}
            onClick={() => onPatch({ bold: !selected.bold })}
          >
            <Bold aria-hidden size={16} />
          </ToolBtn>
          <ToolBtn
            label={t("italic")}
            pressed={selected.italic}
            onClick={() => onPatch({ italic: !selected.italic })}
          >
            <Italic aria-hidden size={16} />
          </ToolBtn>
          {VISION_TEXT_ALIGNS.map((align) => (
            <ToolBtn
              key={align}
              label={t(`align_${align}`)}
              pressed={selected.align === align}
              onClick={() => onPatch({ align: align as VisionTextAlign })}
            >
              {align === "left" ? (
                <AlignLeft aria-hidden size={16} />
              ) : align === "center" ? (
                <AlignCenter aria-hidden size={16} />
              ) : (
                <AlignRight aria-hidden size={16} />
              )}
            </ToolBtn>
          ))}
          <Divider />
          <SwatchTrigger
            color={selected.color}
            label={t("color")}
            onClick={() => onOpenColor("text")}
          />
        </>
      ) : null}

      {selected.kind === "image" ? (
        <FrameTrigger label={t("image_frame")} onClick={onOpenImageFrames} />
      ) : null}

      <Divider />

      <ToolBtn
        label={t("rotate_90")}
        onClick={() => {
          onCheckpoint();
          onPatch({ rotation: normalizeRotation(selected.rotation + 90) }, true);
        }}
      >
        <RotateCw aria-hidden size={16} />
      </ToolBtn>

      <label className="ms-1 flex h-11 shrink-0 items-center gap-1.5 px-2 text-xs font-semibold"
        style={{ color: "var(--color-secondary)" }}
      >
        <span className="sr-only">{t("opacity")}</span>
        <input
          type="range"
          aria-label={t("opacity")}
          min={0}
          max={1}
          step={0.05}
          value={selected.opacity}
          onPointerDown={onCheckpoint}
          onKeyDown={onCheckpoint}
          onChange={(event) => onPatch({ opacity: Number(event.target.value) }, true)}
          className="w-16 accent-[var(--color-accent)]"
        />
      </label>

      <Divider />

      <ToolBtn label={t("bring_front")} onClick={() => onLayer("front")}>
        <BringToFront aria-hidden size={16} />
      </ToolBtn>
      <ToolBtn label={t("send_back")} onClick={() => onLayer("back")}>
        <SendToBack aria-hidden size={16} />
      </ToolBtn>
      <ToolBtn label={t("duplicate")} onClick={onDuplicate}>
        <Copy aria-hidden size={16} />
      </ToolBtn>
      <ToolBtn label={t("delete")} onClick={onRemove}>
        <Trash2 aria-hidden size={16} />
      </ToolBtn>
    </motion.div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="mx-0.5 h-6 w-px shrink-0"
      style={{ backgroundColor: "rgba(17, 17, 17, 0.08)" }}
    />
  );
}

function FrameTrigger({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      <Frame aria-hidden size={16} />
    </button>
  );
}

function SwatchTrigger({
  color,
  label,
  onClick,
}: {
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      <span
        className="block h-5 w-5 rounded-full"
        style={{
          backgroundColor: color,
          outline: "1px solid rgba(0,0,0,0.12)",
          outlineOffset: "2px",
        }}
      />
    </button>
  );
}

function ToolBtn({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{
        backgroundColor: pressed ? "var(--color-surface-container)" : "transparent",
        color: "var(--color-main)",
      }}
    >
      {children}
    </button>
  );
}
