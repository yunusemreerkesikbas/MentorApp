"use client";
import { X } from "lucide-react";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

import { PuhuImage } from "@/components/puhu-image";
import { Link } from "@/i18n/navigation";

const NUDGE_DISMISS_KEY = "mentor.desktop-coach-fab.nudge-dismissed";
const POSITION_KEY = "mentor.desktop-coach-fab.position";
/** Ignore tiny pointer jitter so a click still navigates to /coach. */
const DRAG_THRESHOLD_PX = 6;
/** Keep the FAB clear of the viewport edge (matches `bottom-6` / `right-6`). */
const EDGE_PAD_PX = 24;

type FabOffset = { x: number; y: number };

const ZERO_OFFSET: FabOffset = { x: 0, y: 0 };

/** Read once on the client; the dismiss action drives re-renders via local state instead. */
const subscribeStoredDismiss = () => () => undefined;

function readStoredDismiss(): boolean {
  try {
    return sessionStorage.getItem(NUDGE_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * useSyncExternalStore compares snapshots with Object.is — getSnapshot must return
 * the same reference when the stored value has not changed.
 */
let cachedOffsetRaw: string | null | undefined;
let cachedOffset: FabOffset = ZERO_OFFSET;

function readStoredOffset(): FabOffset {
  try {
    const raw = sessionStorage.getItem(POSITION_KEY);
    if (raw === cachedOffsetRaw) return cachedOffset;
    cachedOffsetRaw = raw;
    if (!raw) {
      cachedOffset = ZERO_OFFSET;
      return cachedOffset;
    }
    const parsed = JSON.parse(raw) as Partial<FabOffset>;
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      cachedOffset = { x: parsed.x, y: parsed.y };
      return cachedOffset;
    }
  } catch {
    // sessionStorage / JSON may be unavailable
  }
  cachedOffsetRaw = null;
  cachedOffset = ZERO_OFFSET;
  return cachedOffset;
}

function writeStoredOffset(offset: FabOffset) {
  const raw = JSON.stringify(offset);
  cachedOffsetRaw = raw;
  cachedOffset = offset;
  try {
    sessionStorage.setItem(POSITION_KEY, raw);
  } catch {
    // sessionStorage may be blocked
  }
}

function clampOffset(
  next: FabOffset,
  base: { left: number; top: number; width: number; height: number },
): FabOffset {
  if (typeof window === "undefined") return next;
  const minX = EDGE_PAD_PX - base.left;
  const maxX = window.innerWidth - EDGE_PAD_PX - base.width - base.left;
  const minY = EDGE_PAD_PX - base.top;
  const maxY = window.innerHeight - EDGE_PAD_PX - base.height - base.top;
  return {
    x: Math.min(Math.max(next.x, Math.min(minX, maxX)), Math.max(minX, maxX)),
    y: Math.min(Math.max(next.y, Math.min(minY, maxY)), Math.max(minY, maxY)),
  };
}

/**
 * Desktop-only floating Puhu coach entry (bottom-right).
 * Mobile keeps the elevated center tab FAB — this must stay `hidden lg:block`.
 * Press-and-drag repositions; a short click still opens `/coach`.
 */
export function DesktopCoachFab() {
  const t = useTranslations("nav");
  const reduceMotion = useReducedMotion();
  // Server renders the nudge hidden, so hydration never flashes it before the storage read.
  const storedDismiss = useSyncExternalStore(
    subscribeStoredDismiss,
    readStoredDismiss,
    () => true,
  );
  const storedOffset = useSyncExternalStore(
    subscribeStoredDismiss,
    readStoredOffset,
    () => ZERO_OFFSET,
  );
  const [dismissedNow, setDismissedNow] = useState(false);
  const [liveOffset, setLiveOffset] = useState<FabOffset | null>(null);
  const [dragging, setDragging] = useState(false);
  const nudgeDismissed = storedDismiss || dismissedNow;
  const offset = liveOffset ?? storedOffset;

  const rootRef = useRef<HTMLDivElement>(null);
  /*
   * `startDrag` needs the current offset without re-subscribing, so it reads this ref. Synced in an
   * effect rather than during render: a ref written in render is applied even by a render React
   * discards. It cannot simply be dropped either — `storedOffset` comes from `useSyncExternalStore`
   * and changes after mount (the server snapshot is ZERO_OFFSET), so without this the first drag
   * after hydration would start from the corner.
   *
   * Event handlers only run after a commit, so the ref is always current by the time one reads it.
   */
  const offsetRef = useRef(offset);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    baseLeft: number;
    baseTop: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);

  function handleDismissNudge() {
    setDismissedNow(true);
    try {
      sessionStorage.setItem(NUDGE_DISMISS_KEY, "1");
    } catch {
      // sessionStorage may be blocked; keep dismiss in memory for this mount
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLAnchorElement>) {
    if (event.button !== 0) return;
    const root = rootRef.current;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    const current = offsetRef.current;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: current.x,
      originY: current.y,
      baseLeft: rect.left - current.x,
      baseTop: rect.top - current.y,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLAnchorElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    if (!drag.moved) {
      drag.moved = true;
      setDragging(true);
    }

    const next = clampOffset(
      { x: drag.originX + dx, y: drag.originY + dy },
      {
        left: drag.baseLeft,
        top: drag.baseTop,
        width: drag.width,
        height: drag.height,
      },
    );
    offsetRef.current = next;
    setLiveOffset(next);
  }

  function endDrag(event: React.PointerEvent<HTMLAnchorElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.moved) {
      suppressClickRef.current = true;
      writeStoredOffset(offsetRef.current);
    }
    dragRef.current = null;
    setDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (suppressClickRef.current) {
      event.preventDefault();
      suppressClickRef.current = false;
    }
  }

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed bottom-6 right-6 z-30 hidden flex-col items-end gap-2 lg:flex"
      data-testid="desktop-coach-fab"
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        willChange: dragging ? "transform" : undefined,
      }}
    >
      {!nudgeDismissed ? (
        <div className="pointer-events-auto relative">
          <div className="mentor-coach-bubble mentor-coach-bubble--end relative max-w-[280px] rounded-[var(--radius-card)] border border-white bg-white p-4 shadow-[var(--shadow-card)]">
            <button
              type="button"
              onClick={handleDismissNudge}
              className="absolute right-2 top-2 inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{ color: "var(--color-secondary)" }}
              aria-label={t("coach_fab_dismiss")}
            >
              <X className="size-4" aria-hidden />
            </button>
            <p
              className="pr-6 text-sm leading-relaxed"
              style={{
                color: "var(--color-body)",
                fontFamily: "var(--font-body)",
              }}
            >
              {t("coach_fab_nudge")}
            </p>
          </div>
        </div>
      ) : null}

      <Link
        href="/coach"
        aria-label={t("coach_fab_aria")}
        aria-grabbed={dragging || undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={handleClick}
        onDragStart={(event) => event.preventDefault()}
        className={`pointer-events-auto inline-flex min-h-11 min-w-11 touch-none select-none items-center justify-center rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        } ${!reduceMotion && !dragging ? "mentor-puhu-bounce" : ""}`}
        draggable={false}
      >
        <PuhuImage variant="encouraging" size="md" />
      </Link>
    </div>
  );
}
