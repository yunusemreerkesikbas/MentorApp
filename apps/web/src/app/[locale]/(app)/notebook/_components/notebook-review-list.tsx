"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";
import {
  FAN_TIMING,
  dealDelay,
  dealDuration,
  fanGeometry,
  foldPlacement,
  followAnchor,
  handPlacement,
  pilePlacement,
  type FanGeometry,
  type FanPlacement,
  type ReviewCardBox,
} from "@/lib/notebook-review-fan";
import { DeckButton } from "./notebook-review-deck-button";
import {
  NotebookReviewFanCard,
  type FanCardRole,
  type FanCardTiming,
} from "./notebook-review-fan-card";

/**
 * The deck as a hand of cards ("Yelpaze").
 *
 * It used to be a stack of title slabs that replaced the card: a good list and the wrong object.
 * The student is holding a deck, and the list is now that deck held in the hand. The review card
 * shrinks into its slot, the two cards drawn behind it spread out beside it, and the cards already
 * answered sit on a small pile in the corner, so progress is something you can see thin out rather
 * than a tick on a row. A tap lifts a card back up into the review card.
 *
 * Navigation only, as before. Nothing in the hand answers a card; the answer is given on the card,
 * where the question is.
 *
 * Geometry lives in `lib/notebook-review-fan.ts`. The cards move on CSS transitions rather than
 * Framer: twenty transforms with their own delays are the compositor's job, and a transition that
 * changes target mid-flight (browsing while the deal is still landing) just retargets.
 */

export interface NotebookReviewListProps {
  /** The deck as it was when the panel opened, already ordered so one subject's cards sit together. */
  entries: NotebookEntryDto[];
  /** By id, not position — the panel and the list must agree on which card is which. */
  currentId: string | null;
  /** In answer order: a `Set` keeps insertion order, and the pile is stacked in it. */
  answered: ReadonlySet<string>;
  /** The review card's box. The hand is dealt from it and folds back into it. */
  origin: RefObject<HTMLElement | null>;
  /** The card the hand is folding back onto, while it does; null while the hand is open. */
  folding: string | null;
  /** Asks the panel to fold the hand onto a card: the one picked, or the current one to close. */
  onFold: (entryId: string) => void;
  /** The fold has landed and the review card can take over. */
  onFolded: () => void;
}

/** Pointer travel before a press on the hand becomes a drag through it. */
const DRAG_SLOP_PX = 6;
/** One wheel notch, one card: a trackpad's stream of tiny deltas would otherwise race through. */
const WHEEL_GAP_MS = 120;
const EASE_OUT = "var(--ease-smooth-out)";
const EASE_FOLD = "cubic-bezier(0.4, 0, 0.2, 1)";

type Phase = "fold" | "dealing" | "open";

export function NotebookReviewList({
  entries,
  currentId,
  answered,
  origin,
  folding,
  onFold,
  onFolded,
}: NotebookReviewListProps) {
  const t = useTranslations("notebook");
  const reduceMotion = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const drag = useRef<{ x: number; pointer: number; start: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const wheelAt = useRef(0);

  const [layout, setLayout] = useState<{ geometry: FanGeometry; box: ReviewCardBox } | null>(
    null,
  );
  // Reduced motion skips the deal: the hand crossfades in already open.
  const [phase, setPhase] = useState<Phase>(reduceMotion ? "open" : "fold");
  const [dragging, setDragging] = useState(false);

  const hand = useMemo(
    () => entries.filter((entry) => !answered.has(entry.id)).map((entry) => entry.id),
    [answered, entries],
  );
  const pile = useMemo(
    () => [...answered].filter((id) => entries.some((entry) => entry.id === id)),
    [answered, entries],
  );
  const [browse, setBrowse] = useState(() => {
    const id = currentId && hand.includes(currentId) ? currentId : (hand[0] ?? null);
    return { id, anchor: Math.max(0, id ? hand.indexOf(id) : 0) };
  });
  const browsed = Math.max(0, browse.id ? hand.indexOf(browse.id) : 0);
  const currentAt = currentId ? hand.indexOf(currentId) : -1;
  const dealOrigin = currentAt >= 0 ? currentAt : browsed;

  // Measured before the first paint, so the hand's first frame lies exactly over the review card it
  // replaces. A frame later would show the dialog with neither.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const frame = root.getBoundingClientRect();
      const geometry = fanGeometry(frame.width, frame.height);
      const card = origin.current?.getBoundingClientRect();
      const box =
        card && card.width > 0
          ? {
              x: card.left - frame.left + card.width / 2,
              y: card.top - frame.top + card.height / 2,
              width: card.width,
            }
          : { x: geometry.handX, y: geometry.handY, width: geometry.cardWidth };
      setLayout({ geometry, box });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [origin]);

  // The deal starts two frames after the hand was painted folded, or the browser merges the two
  // states and the cards appear in place instead of travelling there.
  useEffect(() => {
    if (phase !== "fold" || !layout) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase("dealing"));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [layout, phase]);

  useEffect(() => {
    if (phase !== "dealing") return;
    const timer = setTimeout(() => setPhase("open"), dealDuration(hand.length, dealOrigin));
    return () => clearTimeout(timer);
  }, [dealOrigin, hand.length, phase]);

  useEffect(() => {
    if (!folding) return;
    const timer = setTimeout(
      onFolded,
      reduceMotion ? FAN_TIMING.fadeMs : FAN_TIMING.foldMs + 40,
    );
    return () => clearTimeout(timer);
  }, [folding, onFolded, reduceMotion]);

  // Focus goes to the card the deck is on, once, so ←/→ and Enter work straight away.
  const focused = useRef(false);
  useEffect(() => {
    if (!layout || focused.current || !browse.id) return;
    focused.current = true;
    buttons.current.get(browse.id)?.focus({ preventScroll: true });
  }, [browse.id, layout]);

  const browseTo = useCallback(
    (position: number, focus = false) => {
      if (!layout || hand.length === 0 || folding) return;
      const next = Math.min(hand.length - 1, Math.max(0, position));
      const id = hand[next]!;
      setBrowse((current) =>
        current.id === id
          ? current
          : { id, anchor: followAnchor(current.anchor, next, hand.length, layout.geometry.window) },
      );
      if (focus) buttons.current.get(id)?.focus({ preventScroll: true });
    },
    [folding, hand, layout],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const to =
        event.key === "ArrowRight"
          ? browsed + 1
          : event.key === "ArrowLeft"
            ? browsed - 1
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? hand.length - 1
                : null;
      if (to === null || folding) return;
      event.preventDefault();
      browseTo(to, true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [browseTo, browsed, folding, hand.length]);

  const folded = !reduceMotion && (phase === "fold" || folding !== null);
  const foldOn = folding ?? currentId;
  const foldAt = foldOn ? hand.indexOf(foldOn) : -1;
  const chrome = phase !== "fold" && !folding;

  const cards = layout
    ? entries.map((entry, deckIndex) => {
        const { geometry, box } = layout;
        const pileRank = pile.indexOf(entry.id);
        const position = hand.indexOf(entry.id);
        let role: FanCardRole;
        let placement: FanPlacement;
        let timing: FanCardTiming | null = null;
        if (pileRank >= 0) {
          role = "pile";
          placement = pilePlacement(geometry, pileRank, pile.length);
          if (folded) placement = { ...placement, opacity: 0 };
          timing = {
            ms: FAN_TIMING.browseMs,
            delay: 0,
            ease: EASE_OUT,
            fadeMs: folding ? 200 : FAN_TIMING.chromeMs,
            fadeDelay: phase === "dealing" ? FAN_TIMING.chromeDelayMs : 0,
          };
        } else if (folded) {
          const rank = foldAt < 0 ? position : (position - foldAt + hand.length) % hand.length;
          role = rank === 0 ? "top" : rank <= 2 ? "behind" : "inside";
          placement = foldPlacement(geometry, box, rank);
          timing =
            rank === 0
              ? { ms: FAN_TIMING.foldMs, delay: 0, ease: EASE_OUT, fadeMs: 200, fadeDelay: 0 }
              : {
                  ms: FAN_TIMING.foldRestMs,
                  delay: 0,
                  ease: EASE_FOLD,
                  fadeMs: FAN_TIMING.foldRestMs,
                  fadeDelay: 0,
                };
        } else {
          role = "hand";
          placement = handPlacement(geometry, {
            size: hand.length,
            position,
            browsed,
            anchor: browse.anchor,
          });
          const delay = phase === "dealing" ? dealDelay(position, dealOrigin) : 0;
          timing = {
            ms:
              phase === "dealing"
                ? FAN_TIMING.dealMs
                : dragging
                  ? FAN_TIMING.dragMs
                  : FAN_TIMING.browseMs,
            delay,
            ease: EASE_OUT,
            fadeMs: 240,
            fadeDelay: delay,
          };
        }
        // The first frame lands without travel (it is the review card, already on screen), and
        // reduced motion never travels at all.
        if (phase === "fold" || reduceMotion) timing = null;
        return (
          <NotebookReviewFanCard
            key={entry.id}
            entry={entry}
            role={role}
            placement={placement}
            timing={timing}
            slot={{
              left: geometry.handX - geometry.cardWidth / 2,
              top: geometry.handY - geometry.cardHeight / 2,
              width: geometry.cardWidth,
              height: geometry.cardHeight,
            }}
            faceWidth={box.width}
            hoverLift={geometry.hoverLift}
            current={entry.id === currentId}
            browsed={position === browsed}
            progress={t("review_progress", {
              current: deckIndex + 1,
              total: entries.length,
            })}
            onPick={() => {
              if (!suppressClick.current && !folding) onFold(entry.id);
            }}
            buttonRef={(node) => {
              if (!node) return;
              buttons.current.set(entry.id, node);
              return () => {
                buttons.current.delete(entry.id);
              };
            }}
          />
        );
      })
    : null;

  const browsedEntry = entries.find((entry) => entry.id === browse.id);
  const chromeStyle = {
    opacity: chrome ? 1 : 0,
    transition: reduceMotion
      ? "none"
      : `opacity ${FAN_TIMING.chromeMs}ms ease-out ${phase === "dealing" ? FAN_TIMING.chromeDelayMs : 0}ms`,
  };

  return (
    <motion.div
      ref={rootRef}
      // A stacking context of its own, so the cards' z-indexes stay under the dialog's close / list
      // / edit row (`z-10`) instead of competing with it; `z-[1]` rather than `z-0` keeps it over the
      // verdict row, which is still fading out underneath while the hand is dealt.
      className="absolute inset-0 z-[1] touch-none select-none"
      initial={reduceMotion ? { opacity: 0 } : false}
      animate={{ opacity: reduceMotion && folding ? 0 : 1 }}
      transition={{ duration: FAN_TIMING.fadeMs / 1000, ease: "easeOut" }}
      onPointerDown={(event) => {
        suppressClick.current = false;
        if (folding || event.button !== 0) return;
        drag.current = { x: event.clientX, pointer: event.pointerId, start: browsed, moved: false };
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        if (!state || state.pointer !== event.pointerId || !layout) return;
        const dx = event.clientX - state.x;
        if (!state.moved) {
          if (Math.abs(dx) < DRAG_SLOP_PX) return;
          state.moved = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }
        // The lifted card follows the finger across the hand, the way a card game's hand does.
        browseTo(state.start + Math.round(dx / layout.geometry.dragStep));
      }}
      onPointerUp={() => {
        const state = drag.current;
        drag.current = null;
        if (!state?.moved) return;
        suppressClick.current = true;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onWheel={(event) => {
        const delta =
          Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        const now = performance.now();
        if (Math.abs(delta) < 4 || now - wheelAt.current < WHEEL_GAP_MS) return;
        wheelAt.current = now;
        browseTo(browsed + Math.sign(delta));
      }}
      onClick={(event) => {
        // Never up to the dialog: a tap beside the hand puts the hand away, it does not end the
        // review. Escape works the same way, one layer at a time.
        event.stopPropagation();
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        if (event.target === event.currentTarget && !folding && currentId) onFold(currentId);
      }}
    >
      {layout ? (
        <>
          <div
            aria-hidden
            className="absolute rounded-[var(--radius-card)] border-2 border-dashed"
            style={{
              left: layout.geometry.pileX - layout.geometry.pileWidth / 2,
              top: layout.geometry.pileY - layout.geometry.pileHeight / 2,
              width: layout.geometry.pileWidth,
              height: layout.geometry.pileHeight,
              borderColor: "rgba(255,255,255,0.35)",
              ...chromeStyle,
              opacity: chrome && pile.length === 0 ? 1 : 0,
            }}
          />
          <p
            className="absolute text-xs font-extrabold text-white sm:text-caption"
            style={{
              left: layout.geometry.pileLabel.left,
              top: layout.geometry.pileLabel.top,
              width: layout.geometry.pileLabel.width,
              textAlign: layout.geometry.pileLabel.align,
              ...chromeStyle,
            }}
          >
            {pile.length > 0
              ? t("review_list_pile", { count: pile.length })
              : t("review_list_pile_empty")}
          </p>

          <ol aria-label={t("review_list_title")}>{cards}</ol>

          <div
            className="absolute inset-x-0 z-[1100] flex items-start justify-center gap-3.5"
            style={{ top: layout.geometry.navY, ...chromeStyle }}
            inert={!chrome}
          >
            <DeckButton
              label={t("review_prev")}
              variant="ghost"
              disabled={browsed <= 0}
              onClick={() => browseTo(browsed - 1)}
            >
              <ChevronLeft aria-hidden size={22} strokeWidth={2.25} />
            </DeckButton>
            <span
              aria-hidden
              className="mt-2 flex h-11 min-w-16 items-center justify-center text-sm font-extrabold tabular-nums text-white"
            >
              {browsedEntry
                ? t("review_progress", {
                    current: entries.indexOf(browsedEntry) + 1,
                    total: entries.length,
                  })
                : null}
            </span>
            <DeckButton
              label={t("review_next")}
              variant="ghost"
              disabled={browsed >= hand.length - 1}
              onClick={() => browseTo(browsed + 1)}
            >
              <ChevronRight aria-hidden size={22} strokeWidth={2.25} />
            </DeckButton>
          </div>
        </>
      ) : null}
    </motion.div>
  );
}
