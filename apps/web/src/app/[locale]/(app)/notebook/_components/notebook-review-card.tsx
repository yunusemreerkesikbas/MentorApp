"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Maximize2, MessageCircleQuestion, RotateCw, Undo2 } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import {
  SWIPE_THRESHOLD_PX,
  swipeVerdict,
} from "@/lib/notebook-review-deck";

/**
 * One card in the review deck: question on the front, context on the back, answered by swiping it
 * away or by the buttons the panel puts underneath.
 *
 * The flip is not decoration. Everything on the back — subject, topic, error type, review count —
 * used to sit *on top of* the photo, permanently visible, which meant the student read "Permütasyon
 * · Dikkat hatası" before they read the question. That is a spoiler in a screen whose only purpose
 * is unaided recall: a review that hands over half the answer measures recognition, not retrieval.
 * Front face carries the question and nothing else; the context is one tap away for whoever wants
 * it, and flipping is never required to answer.
 *
 * The box is a fixed 4:5 for every entry, not the photo's own aspect ratio. Two faces have to share
 * one footprint or flipping resizes the card mid-turn, and a deck whose cards are all different
 * shapes cannot show a stack behind the top one. The photo is `object-contain` on the card's own
 * surface, so the leftover space reads as card margin rather than the black letterbox bars a fixed
 * portrait box used to produce — and the zoom control hands the full-bleed view to
 * `NotebookImageLightbox`, which already exists for exactly that.
 *
 * ponytail: the card is a `div` with an `onClick`, not a `button`. It contains its own controls
 * (zoom, flip) and a link on the back; nesting those inside a button is invalid HTML and breaks
 * keyboard order. The flip toggle beside it is the keyboard path — tap-to-flip is the pointer
 * shortcut, never the only way in.
 */

export interface NotebookReviewCardProps {
  entry: NotebookEntryDto;
  /** Answer in flight — freezes the gesture so one card cannot be answered twice. */
  busy: boolean;
  onSolved: () => void;
  onMissed: () => void;
  /** Full-size preview; null for a text-only entry, which has no photo to open. */
  onZoom: (() => void) | null;
}

/**
 * Tight enough that the card visibly foreshortens as it turns — the same reasoning (and roughly the
 * same value) as the notebook's own page turn, where a far perspective flattened the arc into a wipe.
 */
const FLIP_PERSPECTIVE_PX = 1400;

/** Pointer travel past which a gesture is a drag, so the click that follows it must not flip. */
const TAP_SLOP_PX = 4;

/** Where the verdict labels start fading in — early enough to read as a hint, not a verdict yet. */
const LABEL_START_PX = 36;

/**
 * One width for everything the deck stacks vertically — card, stack card, action bar, list — so the
 * modal never changes width as the student moves between them. Capped by viewport height as well as
 * width: at `60vh` wide the 4:5 box lands at 75vh tall, leaving room for the actions underneath.
 */
export const REVIEW_CARD_WIDTH = "w-[min(92vw,26rem,60vh)]";

/**
 * The card's footprint, shared with the stack card the panel draws behind it — one deck means one
 * box, and a second copy of these numbers is a deck that drifts out of alignment on the next edit.
 */
export const REVIEW_CARD_BOX = `aspect-[4/5] ${REVIEW_CARD_WIDTH}`;

export function NotebookReviewCard({
  entry,
  busy,
  onSolved,
  onMissed,
  onZoom,
}: NotebookReviewCardProps) {
  const t = useTranslations("notebook");
  const reduceMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(false);

  /**
   * A drag ends with a click on the same element, which would flip the card the student just
   * answered. Set while the pointer travels, cleared when a fresh one goes down.
   */
  const dragMoved = useRef(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-9, 0, 9]);
  const missedOpacity = useTransform(
    x,
    [-SWIPE_THRESHOLD_PX, -LABEL_START_PX],
    [1, 0],
  );
  const solvedOpacity = useTransform(
    x,
    [LABEL_START_PX, SWIPE_THRESHOLD_PX],
    [0, 1],
  );

  const draggable = !reduceMotion && !busy;

  return (
    <motion.div
      className={`relative ${REVIEW_CARD_BOX} touch-pan-y overflow-hidden rounded-[var(--radius-card)]`}
      style={{
        x,
        rotate,
        backgroundColor: "var(--color-bg)",
        boxShadow: "var(--shadow-card)",
        perspective: reduceMotion ? undefined : FLIP_PERSPECTIVE_PX,
        cursor: draggable ? "grab" : "default",
      }}
      drag={draggable ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.55}
      dragSnapToOrigin
      whileDrag={{ cursor: "grabbing" }}
      onPointerDown={() => {
        dragMoved.current = false;
      }}
      onDrag={(_, info) => {
        if (Math.abs(info.offset.x) > TAP_SLOP_PX) dragMoved.current = true;
      }}
      onDragEnd={(_, info) => {
        const verdict = swipeVerdict(info.offset.x, info.velocity.x);
        if (verdict === "solved") onSolved();
        if (verdict === "missed") onMissed();
      }}
      onClick={() => {
        if (dragMoved.current || busy) return;
        setFlipped((current) => !current);
      }}
    >
      {reduceMotion ? (
        // No 3D at all rather than a slower turn: a card rotating through 180° is the motion being
        // opted out of, and only one face is ever mounted so the hidden one cannot take focus.
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={flipped ? "back" : "front"}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {flipped ? (
              <CardBack entry={entry} />
            ) : (
              <CardFront entry={entry} />
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Both faces stay mounted so the turn has something to show on the way round; `inert`
              keeps the one facing away out of the tab order and away from screen readers. */}
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden" }}
            inert={flipped}
          >
            <CardFront entry={entry} />
          </div>
          <div
            className="absolute inset-0"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
            inert={!flipped}
          >
            <CardBack entry={entry} />
          </div>
        </motion.div>
      )}

      {/* Controls sit outside the turning element: one flip toggle and one zoom button in the DOM
          instead of a duplicate pair per face, which would put a focusable control behind the card. */}
      <div className="absolute right-2 top-2 flex gap-1.5">
        {onZoom && !flipped ? (
          <CardControl
            label={t("review_zoom")}
            onClick={() => {
              dragMoved.current = false;
              onZoom();
            }}
          >
            <Maximize2 aria-hidden size={16} />
          </CardControl>
        ) : null}
        <CardControl
          label={flipped ? t("review_flip_back") : t("review_flip")}
          pressed={flipped}
          onClick={() => setFlipped((current) => !current)}
        >
          {flipped ? (
            <Undo2 aria-hidden size={16} />
          ) : (
            <RotateCw aria-hidden size={16} />
          )}
        </CardControl>
      </div>

      {/* The verdict a release would produce right now, styled as the button it maps to — that
          pairing is the only thing teaching which way means what. */}
      {draggable ? (
        <>
          <motion.span
            aria-hidden
            // Mirrors the secondary action underneath: outlined, never red. Missing a card costs a
            // shorter interval, not a scolding.
            style={{
              opacity: missedOpacity,
              color: "var(--color-main)",
              borderColor:
                "color-mix(in srgb, var(--color-main) 35%, transparent)",
              backgroundColor: "var(--color-bg)",
            }}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 -rotate-6 rounded-[var(--radius-card)] border-2 px-3 py-1.5 text-sm font-bold"
          >
            {t("review_missed")}
          </motion.span>
          <motion.span
            aria-hidden
            style={{
              opacity: solvedOpacity,
              backgroundColor: "var(--color-success)",
              color: "#ffffff",
            }}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-6 rounded-[var(--radius-card)] px-3 py-1.5 text-sm font-bold"
          >
            {t("review_solved")}
          </motion.span>
        </>
      ) : null}
    </motion.div>
  );
}

/** Small round control on the card surface — same shape whichever face is up. */
function CardControl({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex size-11 cursor-pointer items-center justify-center rounded-full outline-none transition-opacity duration-150 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-bg) 78%, transparent)",
        color: "var(--color-main)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {children}
    </button>
  );
}

/**
 * The question, and only the question.
 *
 * A text-only entry has no photo to show, so its subject line stands in as the prompt — there is
 * nothing else that could identify which mistake this is. That is a weaker front than a photo's,
 * and it is the best this entry can do.
 */
function CardFront({ entry }: { entry: NotebookEntryDto }) {
  const t = useTranslations("notebook");
  const label = entry.topicName ?? entry.subjectName;

  if (entry.url) {
    return (
      <Image
        src={entry.url}
        alt=""
        fill
        sizes="(max-width: 640px) 92vw, 26rem"
        className="object-contain"
        priority
      />
    );
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
      <MessageCircleQuestion
        aria-hidden
        size={28}
        style={{ color: "var(--color-secondary)" }}
      />
      <span
        className="text-lg font-bold text-balance"
        style={{ color: "var(--color-main)" }}
      >
        {label ?? t("card_unlabelled")}
      </span>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("review_question")}
      </p>
    </div>
  );
}

/**
 * What this mistake was: the labels the student wrote when they filed it, plus the community
 * answer if one is waiting. The answer link is the only thing on either face they can act on
 * right now, so it gets the accent and the bottom of the card to itself.
 */
function CardBack({ entry }: { entry: NotebookEntryDto }) {
  const t = useTranslations("notebook");
  const label = entry.topicName ?? entry.subjectName;
  const answered = entry.communityAnsweredAt && entry.communityThreadId;

  return (
    <div className="flex size-full flex-col gap-3 overflow-y-auto p-5">
      <span className="text-lg font-bold" style={{ color: "var(--color-main)" }}>
        {label ?? t("card_unlabelled")}
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            color: "var(--color-chip-text)",
            backgroundColor: "var(--color-chip)",
          }}
        >
          {t(`error_type.${entry.errorType}`)}
        </span>
        {entry.reviewCount > 0 ? (
          <span
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: "var(--color-secondary)" }}
          >
            <RotateCw aria-hidden size={12} />
            {t("card_review_count", { count: entry.reviewCount })}
          </span>
        ) : null}
      </div>

      {entry.note ? (
        <p
          className="text-sm text-pretty"
          style={{ color: "var(--color-body)" }}
        >
          {entry.note}
        </p>
      ) : null}

      {answered ? (
        <Link
          href={{
            pathname: "/community/question/[threadId]",
            params: { threadId: entry.communityThreadId! },
          }}
          onClick={(event) => event.stopPropagation()}
          className="mt-auto inline-flex min-h-11 w-fit items-center gap-1.5 rounded-[var(--radius-card)] px-3 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            color: "var(--color-main)",
            backgroundColor: "var(--color-accent-soft)",
          }}
        >
          {t("review_community_answer")}
        </Link>
      ) : null}
    </div>
  );
}
