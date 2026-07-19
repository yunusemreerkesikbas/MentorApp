"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { animate, motion, useReducedMotion, type AnimationPlaybackControls } from "framer-motion";
import { Button } from "@mentor/ui";
import { PuhuImage, type PuhuVariant } from "@/components/puhu-image";

export type MoodWheelOption = {
  value: number;
  variant: PuhuVariant;
  sphere: string;
};

export interface MoodWheelPickerProps {
  value: number | null;
  options: MoodWheelOption[];
  getLabel: (value: number) => string;
  onSelect: (value: number) => void;
  confirmLabel: string;
  hintLabel: string;
  disabled?: boolean;
  ariaLabel: string;
}

/** Sphere backdrops — DESIGN.md tokens only. */
export const MOOD_WHEEL_SPHERES: Record<number, string> = {
  1: "radial-gradient(circle at 32% 26%, color-mix(in srgb, var(--color-progress-track) 90%, white) 0%, var(--color-progress-track) 55%, var(--color-progress) 100%)",
  2: "radial-gradient(circle at 32% 26%, color-mix(in srgb, var(--color-chip) 40%, white) 0%, color-mix(in srgb, var(--color-chip) 60%, white) 55%, var(--color-chip) 100%)",
  3: "radial-gradient(circle at 32% 26%, color-mix(in srgb, var(--color-progress-track) 75%, white) 0%, color-mix(in srgb, var(--color-accent) 40%, white) 55%, var(--color-accent) 100%)",
  4: "radial-gradient(circle at 32% 26%, color-mix(in srgb, var(--color-star) 50%, white) 0%, color-mix(in srgb, var(--color-star) 75%, white) 50%, var(--color-star) 100%)",
  5: "radial-gradient(circle at 32% 26%, color-mix(in srgb, var(--color-like-active) 35%, white) 0%, color-mix(in srgb, var(--color-like-active) 58%, white) 52%, var(--color-like-active) 100%)",
};

/**
 * Semicircle wheel — hub below stage; 3 active moods + 2 ghost hints at flanks.
 * Radius scales with stage width so moods span the full picker (not clustered center).
 */
const WHEEL = {
  stepDeg: 56,
  dragPx: 72,
  /** Ignore micro-movement before treating pointer as a drag (desktop clicks). */
  dragThresholdPx: 8,
  centerSize: 112,
  sideSize: 78,
  ghostSize: 52,
  stageHeight: 204,
  /** Center mood sits ~48% down the stage (not pinned to top). */
  centerSlotRatio: 0.48,
  radiusMin: 110,
  radiusMax: 138,
  radiusRatio: 0.44,
} as const;

type WheelGeometry = {
  radius: number;
  stepRad: number;
  hubY: number;
};

function getWheelGeometry(stageWidth: number): WheelGeometry {
  const radius = Math.min(
    Math.max(stageWidth * WHEEL.radiusRatio, WHEEL.radiusMin),
    WHEEL.radiusMax,
  );
  const centerTargetY = WHEEL.stageHeight * WHEEL.centerSlotRatio;
  return {
    radius,
    stepRad: (WHEEL.stepDeg * Math.PI) / 180,
    hubY: centerTargetY + radius,
  };
}

const SHADOW_SIDE = "var(--shadow-card)";
const SHADOW_CENTER =
  "var(--shadow-card), 0 0 0 3px color-mix(in srgb, var(--color-star) 42%, transparent)";

/** Smooth snap spring — slower settle, no bounce. */
const SNAP_SPRING = {
  type: "spring" as const,
  stiffness: 115,
  damping: 34,
  mass: 1.25,
};

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampSelection(selection: number, max: number): number {
  return Math.max(0, Math.min(max, selection));
}

function getSemicirclePosition(
  relativeIndex: number,
  centerX: number,
  geo: WheelGeometry,
) {
  const theta = -Math.PI / 2 + relativeIndex * geo.stepRad;
  return {
    x: centerX + geo.radius * Math.cos(theta),
    y: geo.hubY + geo.radius * Math.sin(theta),
  };
}

type ItemMetrics = {
  size: number;
  opacity: number;
  puhuSize: number;
  shadow: string;
  isCenter: boolean;
  isGhost: boolean;
  interactive: boolean;
};

function resolveItemMetrics(relativeIndex: number): ItemMetrics | null {
  const distance = Math.abs(relativeIndex);
  if (distance > 2.05) return null;

  if (distance > 1.05) {
    const t = clamp01((distance - 1.05) / 1);
    return {
      size: lerp(WHEEL.sideSize, WHEEL.ghostSize, t),
      opacity: lerp(0.8, 0.22, t),
      puhuSize: Math.round(lerp(52, 38, t)),
      shadow: "none",
      isCenter: false,
      isGhost: true,
      interactive: false,
    };
  }

  const t = clamp01(distance / 1.05);
  const isCenter = distance < 0.2;

  return {
    size: lerp(WHEEL.centerSize, WHEEL.sideSize, t),
    opacity: lerp(1, 0.8, t),
    puhuSize: Math.round(lerp(68, 52, t)),
    shadow: isCenter ? SHADOW_CENTER : SHADOW_SIDE,
    isCenter,
    isGhost: false,
    interactive: true,
  };
}

/**
 * Semicircular mood wheel — 3 active + ghost hints; drag/touch to spin.
 */
export function MoodWheelPicker({
  value,
  options,
  getLabel,
  onSelect,
  confirmLabel,
  hintLabel,
  disabled = false,
  ariaLabel,
}: MoodWheelPickerProps) {
  const reduceMotion = useReducedMotion();
  const labelId = useId();

  const resolvedInitialIndex = (() => {
    const found = options.findIndex((o) => o.value === value);
    return found >= 0 ? found : 2;
  })();

  const stageRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartSelection = useRef(0);
  const dragVelocity = useRef(0);
  const lastDragX = useRef(0);
  const lastDragTime = useRef(0);
  const selectionRef = useRef(resolvedInitialIndex);
  const snapAnimRef = useRef<AnimationPlaybackControls | null>(null);
  const dragStartY = useRef(0);
  const pointerCaptured = useRef(false);
  const pointerActive = useRef(false);
  const dragging = useRef(false);

  const maxIndex = options.length - 1;
  const [selection, setSelection] = useState(resolvedInitialIndex);
  const [stageWidth, setStageWidth] = useState(300);

  const centerX = stageWidth / 2;
  const geo = getWheelGeometry(stageWidth);
  const activeIndex = clampSelection(Math.round(selection), maxIndex);
  const activeOption = options[activeIndex] ?? options[0];
  const dialShift = -selection * (geo.radius * 0.11);
  const centerSlot = getSemicirclePosition(0, centerX, geo);
  const pointerY = centerSlot.y + WHEEL.centerSize / 2 + 4;

  const springSnap = useCallback(
    (target: number, velocity = 0) => {
      const clamped = clampSelection(target, maxIndex);
      snapAnimRef.current?.stop();

      if (reduceMotion) {
        setSelection(clamped);
        selectionRef.current = clamped;
        return;
      }

      const from = selectionRef.current;
      if (Math.abs(from - clamped) < 0.001) {
        setSelection(clamped);
        selectionRef.current = clamped;
        return;
      }

      snapAnimRef.current = animate(from, clamped, {
        ...SNAP_SPRING,
        velocity,
        restDelta: 0.002,
        onUpdate: (v) => {
          // Spring overshoots past [0, max]; clamp so off-wheel moods never flash on the flanks.
          const bounded = clampSelection(v, maxIndex);
          selectionRef.current = bounded;
          setSelection(bounded);
        },
        onComplete: () => {
          selectionRef.current = clamped;
          setSelection(clamped);
        },
      });
    },
    [maxIndex, reduceMotion],
  );

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => setStageWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Re-center the wheel when the resolved initial index changes — deliberate external-sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelection(resolvedInitialIndex);
    selectionRef.current = resolvedInitialIndex;
  }, [resolvedInitialIndex]);

  useEffect(() => () => snapAnimRef.current?.stop(), []);

  const handleMoodActivate = useCallback(
    (index: number, isCenter: boolean) => {
      if (disabled) return;
      if (isCenter) onSelect(options[index]?.value ?? options[0].value);
      else springSnap(index);
    },
    [disabled, onSelect, options, springSnap],
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if ((event.target as HTMLElement).closest("[data-mood-item]")) return;

    snapAnimRef.current?.stop();
    dragging.current = false;
    pointerCaptured.current = false;
    pointerActive.current = true;
    dragStartX.current = event.clientX;
    dragStartY.current = event.clientY;
    dragStartSelection.current = selectionRef.current;
    lastDragX.current = event.clientX;
    lastDragTime.current = performance.now();
    dragVelocity.current = 0;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !pointerActive.current) return;

    const dx = event.clientX - dragStartX.current;
    const dy = event.clientY - dragStartY.current;
    const distance = Math.hypot(dx, dy);

    if (!dragging.current) {
      if (distance < WHEEL.dragThresholdPx) return;
      dragging.current = true;
      snapAnimRef.current?.stop();
      dragStartSelection.current = selectionRef.current;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerCaptured.current = true;
    }

    const now = performance.now();
    const dt = now - lastDragTime.current;
    if (dt > 0) {
      dragVelocity.current = (event.clientX - lastDragX.current) / dt;
    }
    lastDragX.current = event.clientX;
    lastDragTime.current = now;

    const deltaSteps = dx / WHEEL.dragPx;
    const next = clampSelection(
      dragStartSelection.current - deltaSteps,
      maxIndex,
    );
    selectionRef.current = next;
    setSelection(next);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    pointerActive.current = false;

    if (pointerCaptured.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      pointerCaptured.current = false;
    }

    if (!dragging.current) return;
    dragging.current = false;

    const deltaSteps = (event.clientX - dragStartX.current) / WHEEL.dragPx;
    const raw = clampSelection(
      dragStartSelection.current - deltaSteps,
      maxIndex,
    );
    const flick = (-dragVelocity.current / WHEEL.dragPx) * 0.06;
    const projected = clampSelection(raw + flick, maxIndex);
    const target = Math.round(projected);
    const stepVelocity = (-dragVelocity.current / WHEEL.dragPx) * 450;

    springSnap(target, stepVelocity);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      springSnap(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      springSnap(activeIndex + 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(activeOption.value);
    }
  };

  const motionTransition = reduceMotion ? { duration: 0 } : { duration: 0 };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div
        className="relative w-full overflow-hidden rounded-[var(--radius-card)] border border-white/80 px-0 pb-2 pt-2"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-progress-track) 40%, white) 0%, color-mix(in srgb, var(--color-chip) 20%, white) 100%)",
        }}
      >
        <div
          ref={stageRef}
          role="listbox"
          aria-label={ariaLabel}
          aria-labelledby={labelId}
          aria-activedescendant={`mood-option-${activeOption.value}`}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          className={[
            "relative mx-auto h-[204px] w-full touch-none select-none outline-none",
            disabled ? "pointer-events-none opacity-60" : "cursor-grab active:cursor-grabbing",
          ].join(" ")}
        >
          {/* Ghost moods first (behind), then active trio on top */}
          {[...options]
            .map((option, index) => ({ option, index }))
            .sort((a, b) => {
              const da = Math.abs(a.index - selection);
              const db = Math.abs(b.index - selection);
              return da - db;
            })
            .map(({ option, index }) => {
              const relativeIndex = index - selection;
              const metrics = resolveItemMetrics(relativeIndex);
              if (!metrics) return null;

              const { x, y } = getSemicirclePosition(relativeIndex, centerX, geo);
              const zIndex = metrics.isGhost ? 2 : metrics.isCenter ? 12 : 8;

              return (
                <motion.div
                  key={option.value}
                  className="absolute"
                  initial={false}
                  style={{ zIndex }}
                  animate={{
                    left: x - metrics.size / 2,
                    top: y - metrics.size / 2,
                    width: metrics.size,
                    height: metrics.size,
                    opacity: metrics.opacity,
                  }}
                  transition={motionTransition}
                >
                  {metrics.interactive ? (
                    <button
                      type="button"
                      role="option"
                      data-mood-item=""
                      id={`mood-option-${option.value}`}
                      aria-selected={metrics.isCenter}
                      aria-label={getLabel(option.value)}
                      disabled={disabled}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMoodActivate(index, metrics.isCenter);
                      }}
                      className="size-full cursor-pointer rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-focus-ring)]"
                    >
                      <span
                        className="relative flex size-full items-center justify-center rounded-full"
                        style={{
                          background: option.sphere,
                          boxShadow: metrics.shadow,
                        }}
                      >
                        <PuhuImage
                          variant={option.variant}
                          size={metrics.puhuSize}
                        />
                      </span>
                    </button>
                  ) : (
                    <span
                      aria-hidden
                      className="relative flex size-full items-center justify-center rounded-full"
                      style={{
                        background: option.sphere,
                        filter: "saturate(0.65)",
                      }}
                    >
                      <PuhuImage
                        variant={option.variant}
                        size={metrics.puhuSize}
                      />
                    </span>
                  )}
                </motion.div>
              );
            })}

          {/* Tick dial — ticks only, width tracks arc spread */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[20] mx-auto h-8 w-[94%]"
            aria-hidden
          >
            <svg viewBox="0 0 260 32" className="h-full w-full overflow-visible">
              <motion.g
                animate={{ x: dialShift }}
                transition={motionTransition}
              >
                {Array.from({ length: 19 }, (_, tick) => {
                  const t = tick / 18;
                  const angle = Math.PI + t * Math.PI;
                  const cx = 130 + 122 * Math.cos(angle);
                  const cy = 26 + 122 * Math.sin(angle);
                  const tall = tick % 4 === 0;
                  const len = tall ? 7 : 4;
                  const nx = Math.cos(angle + Math.PI / 2);
                  const ny = Math.sin(angle + Math.PI / 2);
                  return (
                    <line
                      key={tick}
                      x1={cx}
                      y1={cy}
                      x2={cx + nx * len}
                      y2={cy + ny * len}
                      stroke="color-mix(in srgb, var(--color-main) 12%, transparent)"
                      strokeWidth="1"
                    />
                  );
                })}
              </motion.g>
            </svg>
          </div>

          {/* Pink pointer */}
          <div
            className="pointer-events-none absolute z-[25] w-0.5 rounded-full"
            style={{
              left: centerX,
              top: pointerY,
              height: 22,
              transform: "translateX(-50%)",
              backgroundColor: "var(--color-like-active)",
            }}
            aria-hidden
          />
        </div>
      </div>

      <motion.p
        id={labelId}
        role="status"
        aria-live="polite"
        className="rounded-[var(--radius-card)] px-5 py-2 text-sm font-bold capitalize"
        style={{
          color: "var(--color-chip-text)",
          fontFamily: "var(--font-body)",
          backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
        }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        key={activeOption.value}
        initial={reduceMotion ? false : { opacity: 0.6, y: 2 }}
      >
        {getLabel(activeOption.value)}
      </motion.p>

      <p
        className="max-w-[280px] text-center text-xs leading-relaxed"
        style={{ color: "var(--color-body)", fontFamily: "var(--font-body)" }}
      >
        {hintLabel}
      </p>

      <Button fullWidth busy={disabled} onClick={() => onSelect(activeOption.value)}>
        {confirmLabel}
      </Button>
    </div>
  );
}
