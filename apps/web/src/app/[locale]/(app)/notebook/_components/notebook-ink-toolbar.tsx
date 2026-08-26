"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronLeft,
  ChevronsDownUp,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { InkPenArt } from "@/components/notebook/notebook-ink-pens";
import { RangeSlider } from "@/components/range-slider";
import {
  INK_PALETTE,
  INK_SIZE_MAX,
  INK_SIZE_MIN,
  INK_TOOL_ORDER,
  type InkToolId,
} from "@/lib/notebook-ink";
import { boardChromeTransition } from "../../vision-board/board/_components/board-chrome-motion";
import { NOTEBOOK_TRAY_RADIUS_CLASS } from "./notebook-shell-layout";

/**
 * The drawing toolbar: a tray of pens that slides sideways to the colour and size strips.
 *
 * Sliding rows rather than stacked panels or popovers. The tray is anchored over the notebook, so
 * anything that grew downward would cover the page you are drawing on and anything that grew
 * upward would cover the page too — sideways is the one direction with nothing behind it. Strip
 * switches keep a stable height; hide/show is a clip-reveal to a 44px circle.
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

/**
 * Tracks the anchor point (button centre-x, button top) a hover/focus tooltip should float above.
 * Shared by every control in the tray — pens and icon buttons alike — so they all get the same
 * name reveal on hover or keyboard focus.
 */
function useHoverAnchor<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [anchor, setAnchor] = useState<{ x: number; top: number } | null>(null);
  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ x: rect.left + rect.width / 2, top: rect.top });
  };
  const hide = () => setAnchor(null);
  return { ref, anchor, show, hide };
}

/**
 * The tooltip itself: a `document.body` portal, not a child positioned inside the tray. The tray
 * needs `overflow-hidden` for its own sliding strips (tools/colours/size clip to the rounded pill
 * as they slide past each other), and that same clipping would cut the tooltip off mid-pill unless
 * the tray reserved standing headroom for it above every control all the time — paying height
 * nobody needs except in the instant one specific control is hovered. A portal, positioned from the
 * control's own measured screen rect, floats above the tray's rounded top edge for free instead.
 *
 * Deliberately not the shared `InfoTooltip` — that one is a light card meant to sit on the app's
 * own `--color-surface`, and this tray is the one place in the app that is dark regardless of
 * theme (see the file header). A light tooltip popping out of a dark tray would look like a
 * mistake, not a design choice.
 */
function HoverTip({
  anchor,
  label,
  reduceMotion,
}: {
  anchor: { x: number; top: number } | null;
  label: string;
  reduceMotion: boolean;
}) {
  if (!anchor || typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      <motion.div
        role="tooltip"
        initial={
          reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.94 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.94 }}
        transition={{ duration: reduceMotion ? 0 : 0.12 }}
        className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold shadow-lg"
        style={{
          left: anchor.x,
          top: anchor.top - 8,
          backgroundColor: "#111318",
          color: CONTROL_FG,
        }}
      >
        {label}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

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
  const reduceMotion = useReducedMotion();
  const { ref, anchor, show, hide } = useHoverAnchor<HTMLButtonElement>();
  return (
    <>
      <HoverTip
        anchor={anchor}
        label={label}
        reduceMotion={Boolean(reduceMotion)}
      />
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center self-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-35"
        style={{
          color: CONTROL_FG,
          backgroundColor: pressed ? "rgba(255,255,255,0.12)" : "transparent",
        }}
      >
        {children}
      </button>
    </>
  );
}

/**
 * Perceived brightness (ITU-R BT.601), not full WCAG contrast — this only has to pick a side
 * (dark check vs light check) for seventeen fixed swatches, not certify a ratio.
 */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

function Divider() {
  return (
    <span
      aria-hidden
      className="h-7 w-px shrink-0 self-center"
      style={{ backgroundColor: TRAY_BORDER }}
    />
  );
}

/** Idle → hover → selected: each step stretches the pen a little taller than the last. */
const TOOL_SCALE_IDLE = 1;
const TOOL_SCALE_HOVER = 1.08;
const TOOL_SCALE_ACTIVE = 1.18;

/** A pen, its grow-on-hover/select animation, and a name tooltip that appears above it on hover/focus. */
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
  const { ref, anchor, show, hide } = useHoverAnchor<HTMLButtonElement>();
  // Selected always wins over hover — resting the pointer on the pen you already picked should not
  // grow it past where picking it already put it.
  const scaleY = active
    ? TOOL_SCALE_ACTIVE
    : anchor
      ? TOOL_SCALE_HOVER
      : TOOL_SCALE_IDLE;

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <HoverTip anchor={anchor} label={label} reduceMotion={reduceMotion} />
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={active}
        onFocus={show}
        onBlur={hide}
        onClick={onClick}
        className="flex h-16 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        {/*
          Grows from its own centre rather than translating bodily — `scaleY` keeps the pen's
          middle anchored while it stretches, so it reads as swelling in place on the same
          baseline as the icon buttons beside it.
        */}
        <motion.span
          animate={{ scaleY }}
          transition={reduceMotion ? { duration: 0 } : boardChromeTransition}
          className="block"
          style={{ opacity: active ? 1 : 0.72, transformOrigin: "50% 50%" }}
        >
          <InkPenArt tool={id} color={color} size={52} />
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
  // Drag boundary: a full-viewport, invisible box the draggable tray is clamped to, so it can be
  // repositioned freely but never dragged past the edge of the screen.
  const constraintsRef = useRef<HTMLDivElement>(null);

  /*
   * A strip slides in from the side it conceptually came from: forward strips enter from the
   * right, and going back reverses it. Reduced motion drops the travel and keeps only the fade —
   * the strips still read as replacing each other, without the movement.
   */
  const slide = (from: number) =>
    reduceMotion
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        }
      : {
          initial: { opacity: 0, x: from },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -from },
        };

  // One tray, clip-reveal: collapsed is a 44px circle; open grows width/height to the strip.
  // The pen face sits on an opaque disc so the first control cannot leak through the circle.
  const trayMotion = reduceMotion ? { duration: 0 } : boardChromeTransition;

  return (
    <>
      <div
        ref={constraintsRef}
        aria-hidden
        className="pointer-events-none fixed inset-0"
      />
      <motion.div
        role="toolbar"
        aria-label={t("toolbar")}
        drag
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={constraintsRef}
        initial={false}
        animate={{
          width: collapsed ? "2.75rem" : "max-content",
          height: collapsed ? "2.75rem" : "auto",
        }}
        transition={trayMotion}
        className={`pointer-events-auto relative overflow-hidden ${NOTEBOOK_TRAY_RADIUS_CLASS}`}
        style={{
          backgroundColor: TRAY_BG,
          border: `1px solid ${TRAY_BORDER}`,
          maxWidth: "min(92vw, 720px)",
        }}
      >
        <div inert={collapsed} aria-hidden={collapsed}>
          <AnimatePresence mode="wait" initial={false}>
            {strip === "tools" ? (
              <motion.div
                key="tools"
                {...slide(24)}
                transition={boardChromeTransition}
                // Centred cross-axis so every control — pens included — sits on one shared baseline
                // instead of the pens planting on the tray floor while the icon buttons float above it.
                className="mentor-scrollarea flex max-w-[min(92vw,720px)] items-center gap-1 overflow-x-auto px-2 py-2"
              >
                <ControlButton
                  label={t("undo")}
                  onClick={onUndo}
                  disabled={!canUndo}
                >
                  <Undo2 aria-hidden size={18} />
                </ControlButton>
                <ControlButton
                  label={t("redo")}
                  onClick={onRedo}
                  disabled={!canRedo}
                >
                  <Redo2 aria-hidden size={18} />
                </ControlButton>
                <ControlButton
                  label={t("clear")}
                  onClick={onClear}
                  disabled={!hasInk}
                >
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
                <ControlButton
                  label={t("size_and_opacity")}
                  onClick={() => setStrip("size")}
                >
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
                <ControlButton
                  label={t("colors")}
                  onClick={() => setStrip("colors")}
                >
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
                <ControlButton
                  label={t("hide_tools")}
                  onClick={() => setCollapsed(true)}
                >
                  <ChevronsDownUp aria-hidden size={18} />
                </ControlButton>
              </motion.div>
            ) : strip === "colors" ? (
              <motion.div
                key="colors"
                {...slide(24)}
                transition={boardChromeTransition}
                className="mentor-scrollarea flex max-w-[min(92vw,720px)] items-center gap-0.5 overflow-x-auto px-2 py-2"
              >
                <ControlButton
                  label={t("back")}
                  onClick={() => setStrip("tools")}
                >
                  <ChevronLeft aria-hidden size={18} />
                </ControlButton>
                <Divider />
                {INK_PALETTE.map((swatch) => {
                  const selected = swatch === color;
                  return (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={swatch}
                      title={swatch}
                      aria-pressed={selected}
                      onClick={() => onColorChange(swatch)}
                      // The hit target stays 44px (DESIGN.md's touch-target floor) even though the
                      // swatch drawn inside it is smaller — 17 colours at a tighter gap need the
                      // visual to shrink, but shrinking the tap target with it would make picking one
                      // on a phone a matter of luck.
                      className="relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                    >
                      <span
                        aria-hidden
                        className="block size-6 rounded-[8px] transition-transform"
                        style={{
                          backgroundColor: swatch,
                          // The selected swatch grows and gets a ring; a border alone disappears on the
                          // dark swatches and a ring alone disappears on the light ones.
                          transform: selected ? "scale(1.15)" : undefined,
                          boxShadow: selected
                            ? `0 0 0 2px ${TRAY_BG}, 0 0 0 4px #ffffff`
                            : "0 0 0 1px rgba(255,255,255,0.18)",
                        }}
                      />
                      {selected ? (
                        // A drop-shadow alone doesn't survive the palette's own white swatch — the
                        // check needs to flip to dark ink there, not just gain an outline.
                        <Check
                          aria-hidden
                          size={12}
                          strokeWidth={3}
                          className="pointer-events-none absolute"
                          style={{
                            color: isLightColor(swatch) ? "#111318" : "#ffffff",
                          }}
                        />
                      ) : null}
                    </button>
                  );
                })}
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
                <ControlButton
                  label={t("back")}
                  onClick={() => setStrip("tools")}
                >
                  <ChevronLeft aria-hidden size={18} />
                </ControlButton>
                <Divider />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
                  <label className="flex items-center gap-2">
                    <span
                      className="w-14 shrink-0 text-xs"
                      style={{ color: CONTROL_FG }}
                    >
                      {t("size")}
                    </span>
                    <RangeSlider
                      label={t("size")}
                      min={INK_SIZE_MIN}
                      max={INK_SIZE_MAX}
                      step={1}
                      value={size}
                      onChange={onSizeChange}
                      trackColor="rgba(255,255,255,0.18)"
                      showValue={false}
                      className="min-w-0 flex-1"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span
                      className="w-14 shrink-0 text-xs"
                      style={{ color: CONTROL_FG }}
                    >
                      {t("opacity")}
                    </span>
                    <RangeSlider
                      label={t("opacity")}
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={opacity}
                      onChange={onOpacityChange}
                      trackColor="rgba(255,255,255,0.18)"
                      showValue={false}
                      className="min-w-0 flex-1"
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
        </div>
        <motion.button
          type="button"
          aria-hidden={!collapsed}
          tabIndex={collapsed ? 0 : -1}
          aria-label={t("show_tools")}
          title={t("show_tools")}
          onClick={() => setCollapsed(false)}
          initial={false}
          animate={{ opacity: collapsed ? 1 : 0 }}
          transition={trayMotion}
          className="absolute top-0 left-0 z-[1] inline-flex size-11 cursor-pointer items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            color: CONTROL_FG,
            backgroundColor: TRAY_BG,
            pointerEvents: collapsed ? "auto" : "none",
          }}
        >
          <InkPenArt tool={tool} color={color} size={34} />
        </motion.button>
      </motion.div>
    </>
  );
}
