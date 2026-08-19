"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronsDownUp,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { InkPenArt } from "@/components/notebook/notebook-ink-pens";
import {
  INK_PALETTE,
  INK_SIZE_MAX,
  INK_SIZE_MIN,
  INK_TOOL_ORDER,
  type InkToolId,
} from "@/lib/notebook-ink";
import { boardChromeTransition } from "../../vision-board/board/_components/board-chrome-motion";

/**
 * The drawing toolbar: a tray of pens that slides sideways to the colour and size strips.
 *
 * Sliding rows rather than stacked panels or popovers. The tray is anchored over the notebook, so
 * anything that grew downward would cover the page you are drawing on and anything that grew
 * upward would cover the page too — sideways is the one direction with nothing behind it. It also
 * means the tray never changes height, so the notebook above it never reflows mid-drawing.
 *
 * Dark surface on purpose, and the one place in the app that does not take `--color-surface`: the
 * pens are drawn as physical objects lying on a tray, and a white tray under a white-inked pen
 * makes the selected tool invisible. It reads the same in both themes because it *is* the same in
 * both themes.
 */

type Strip = "tools" | "colors" | "size";

export interface NotebookInkToolbarProps {
  tool: InkToolId;
  color: string;
  size: number;
  opacity: number;
  canUndo: boolean;
  canRedo: boolean;
  hasInk: boolean;
  onToolChange: (tool: InkToolId) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onOpacityChange: (opacity: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

const TRAY_BG = "#26282e";
const TRAY_BORDER = "rgba(255,255,255,0.09)";
const CONTROL_FG = "#e7e9ee";

/** 44px hit target with a smaller visual, DESIGN.md's floor for anything tapped on a phone. */
function ControlButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-35"
      style={{
        color: CONTROL_FG,
        backgroundColor: pressed ? "rgba(255,255,255,0.12)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="h-7 w-px shrink-0"
      style={{ backgroundColor: TRAY_BORDER }}
    />
  );
}

/**
 * A pen, its lift-on-select animation, and a name tooltip that appears above it on hover/focus.
 *
 * The tooltip is deliberately not the shared `InfoTooltip` — that one is a light card meant to sit
 * on the app's own `--color-surface`, and this tray is the one place in the app that is dark
 * regardless of theme (see the file header). A light tooltip popping out of a dark tray would look
 * like a mistake, not a design choice.
 */
function ToolButton({
  id,
  label,
  color,
  active,
  reduceMotion,
  onClick,
}: {
  id: InkToolId;
  label: string;
  color: string;
  active: boolean;
  reduceMotion: boolean;
  onClick: () => void;
}) {
  // Keyboard focus counts as "hovering" too — a keyboard user tabbing through the tray gets the
  // same name reveal a mouse user does, via the button's own onFocus/onBlur below.
  const [hovering, setHovering] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <AnimatePresence>
        {hovering ? (
          <motion.div
            role="tooltip"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.94 }}
            transition={{ duration: reduceMotion ? 0 : 0.12 }}
            className="pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold shadow-lg"
            style={{ backgroundColor: "#111318", color: CONTROL_FG }}
          >
            {label}
            <span
              aria-hidden
              className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1/2 rotate-45"
              style={{ backgroundColor: "#111318" }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
        onClick={onClick}
        className="flex h-16 w-11 shrink-0 cursor-pointer items-end justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        {/*
          The selected pen lifts out of the tray. Translating the art rather than the button keeps
          the 44px hit target exactly where the finger expects it.
        */}
        <motion.span
          animate={{ y: active ? -10 : 0 }}
          transition={reduceMotion ? { duration: 0 } : boardChromeTransition}
          className="block"
          style={{ opacity: active ? 1 : 0.72 }}
        >
          <InkPenArt tool={id} color={color} size={58} />
        </motion.span>
      </button>
    </div>
  );
}

export function NotebookInkToolbar({
  tool,
  color,
  size,
  opacity,
  canUndo,
  canRedo,
  hasInk,
  onToolChange,
  onColorChange,
  onSizeChange,
  onOpacityChange,
  onUndo,
  onRedo,
  onClear,
}: NotebookInkToolbarProps) {
  const t = useTranslations("notebook.draw");
  const reduceMotion = useReducedMotion();
  const [strip, setStrip] = useState<Strip>("tools");
  const [collapsed, setCollapsed] = useState(false);

  /*
   * A strip slides in from the side it conceptually came from: forward strips enter from the
   * right, and going back reverses it. Reduced motion drops the travel and keeps only the fade —
   * the strips still read as replacing each other, without the movement.
   */
  const slide = (from: number) =>
    reduceMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
      : {
          initial: { opacity: 0, x: from },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -from },
        };

  if (collapsed) {
    return (
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        transition={boardChromeTransition}
        className="pointer-events-auto flex items-center rounded-full px-1 py-1"
        style={{ backgroundColor: TRAY_BG, border: `1px solid ${TRAY_BORDER}` }}
      >
        <button
          type="button"
          aria-label={t("show_tools")}
          title={t("show_tools")}
          onClick={() => setCollapsed(false)}
          className="inline-flex h-11 cursor-pointer items-center gap-1 rounded-full px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: CONTROL_FG }}
        >
          <InkPenArt tool={tool} color={color} size={34} />
          <span className="text-sm">{t(`tool_${tool}`)}</span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      role="toolbar"
      aria-label={t("toolbar")}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={boardChromeTransition}
      className="pointer-events-auto overflow-hidden rounded-[28px]"
      style={{ backgroundColor: TRAY_BG, border: `1px solid ${TRAY_BORDER}` }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {strip === "tools" ? (
          <motion.div
            key="tools"
            {...slide(24)}
            transition={boardChromeTransition}
            className="mentor-scrollarea flex max-w-[min(92vw,720px)] items-center gap-1 overflow-x-auto px-2 py-2"
          >
            <ControlButton label={t("undo")} onClick={onUndo} disabled={!canUndo}>
              <Undo2 aria-hidden size={18} />
            </ControlButton>
            <ControlButton label={t("redo")} onClick={onRedo} disabled={!canRedo}>
              <Redo2 aria-hidden size={18} />
            </ControlButton>
            <ControlButton label={t("clear")} onClick={onClear} disabled={!hasInk}>
              <Trash2 aria-hidden size={18} />
            </ControlButton>

            <Divider />

            {INK_TOOL_ORDER.map((id) => (
              <ToolButton
                key={id}
                id={id}
                label={t(`tool_${id}`)}
                color={color}
                active={id === tool}
                reduceMotion={Boolean(reduceMotion)}
                onClick={() => onToolChange(id)}
              />
            ))}

            <Divider />

            {/* Current ink at current width — tapping it opens the size strip. */}
            <ControlButton label={t("size_and_opacity")} onClick={() => setStrip("size")}>
              <span
                aria-hidden
                className="block rounded-full"
                style={{
                  width: `${Math.max(8, Math.min(26, size))}px`,
                  height: `${Math.max(8, Math.min(26, size))}px`,
                  backgroundColor: color,
                  opacity,
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.25)",
                }}
              />
            </ControlButton>
            <ControlButton label={t("colors")} onClick={() => setStrip("colors")}>
              {/* The colour wheel: a conic sweep, so it reads as "any colour" rather than one. */}
              <span
                aria-hidden
                className="block size-6 rounded-full"
                style={{
                  background:
                    "conic-gradient(#e0342a,#f5a623,#ffd600,#8bc34a,#14b8a6,#2563eb,#5b3df5,#ec4899,#e0342a)",
                }}
              />
            </ControlButton>
            <ControlButton label={t("hide_tools")} onClick={() => setCollapsed(true)}>
              <ChevronsDownUp aria-hidden size={18} />
            </ControlButton>
          </motion.div>
        ) : strip === "colors" ? (
          <motion.div
            key="colors"
            {...slide(24)}
            transition={boardChromeTransition}
            className="mentor-scrollarea flex max-w-[min(92vw,720px)] items-center gap-1 overflow-x-auto px-2 py-2"
          >
            <ControlButton label={t("back")} onClick={() => setStrip("tools")}>
              <ChevronLeft aria-hidden size={18} />
            </ControlButton>
            <Divider />
            {INK_PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                title={swatch}
                aria-pressed={swatch === color}
                onClick={() => onColorChange(swatch)}
                className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <span
                  aria-hidden
                  className="block size-7 rounded-[9px] transition-transform"
                  style={{
                    backgroundColor: swatch,
                    // The selected swatch grows and gets a ring; a border alone disappears on the
                    // dark swatches and a ring alone disappears on the light ones.
                    transform: swatch === color ? "scale(1.15)" : undefined,
                    boxShadow:
                      swatch === color
                        ? `0 0 0 2px ${TRAY_BG}, 0 0 0 4px #ffffff`
                        : "0 0 0 1px rgba(255,255,255,0.18)",
                  }}
                />
              </button>
            ))}
            <Divider />
            {/*
              Custom colour is the platform's own picker. A bespoke one would be an eyedropper, a
              hue wheel and a hex field to build and maintain, and the native control is already
              keyboard-accessible and knows the OS palette.
            */}
            <label
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)]"
              title={t("custom_color")}
            >
              <span className="sr-only">{t("custom_color")}</span>
              <input
                type="color"
                value={color}
                onChange={(event) => onColorChange(event.target.value)}
                className="size-7 cursor-pointer rounded-[9px] border-0 bg-transparent p-0"
              />
            </label>
          </motion.div>
        ) : (
          <motion.div
            key="size"
            {...slide(24)}
            transition={boardChromeTransition}
            className="flex w-[min(92vw,420px)] items-center gap-3 px-2 py-2"
          >
            <ControlButton label={t("back")} onClick={() => setStrip("tools")}>
              <ChevronLeft aria-hidden size={18} />
            </ControlButton>
            <Divider />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
              <label className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs" style={{ color: CONTROL_FG }}>
                  {t("size")}
                </span>
                <input
                  type="range"
                  className="mentor-range h-1.5 min-w-0 flex-1"
                  min={INK_SIZE_MIN}
                  max={INK_SIZE_MAX}
                  step={1}
                  value={size}
                  onChange={(event) => onSizeChange(Number(event.target.value))}
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs" style={{ color: CONTROL_FG }}>
                  {t("opacity")}
                </span>
                <input
                  type="range"
                  className="mentor-range h-1.5 min-w-0 flex-1"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={opacity}
                  onChange={(event) => onOpacityChange(Number(event.target.value))}
                />
              </label>
            </div>
            {/* Live preview at true scale, so the sliders are judged by the mark, not the number. */}
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center"
            >
              <span
                className="block rounded-full"
                style={{
                  width: `${Math.max(4, Math.min(40, size))}px`,
                  height: `${Math.max(4, Math.min(40, size))}px`,
                  backgroundColor: color,
                  opacity,
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.25)",
                }}
              />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
