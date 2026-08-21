"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  Maximize2,
  MessageCircleQuestion,
  Pencil,
  RotateCw,
  Undo2,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";
import { NOTEBOOK_NOTE_MAX_LENGTH } from "@mentor/validation";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { NotebookCompactButton } from "@/components/notebook/notebook-compact-button";
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
  /** Persists the note edited on the back; rejects so the field can show its own failure. */
  onNoteSave: (note: string | null) => Promise<void>;
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
  onNoteSave,
}: NotebookReviewCardProps) {
  const t = useTranslations("notebook");
  const reduceMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  /** A caret is in the note field: the card must stop answering and stop turning under it. */
  const [editing, setEditing] = useState(false);

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

  const draggable = !reduceMotion && !busy && !editing;

  return (
    <motion.div
      className={`relative ${REVIEW_CARD_BOX} touch-pan-y overflow-hidden rounded-[var(--radius-card)]`}
      style={{
        x,
        rotate,
        // `--color-surface`, not `--color-bg`: on the dark theme the two are #1a1d24 and #12141a,
        // and the card sits on an 85%-black scrim — at `bg` it dissolves into the backdrop with no
        // edge at all. The hairline is the same one `NotebookEntryCard` draws, and it is what gives
        // the card a border in the dark theme where the shadow cannot.
        backgroundColor: "var(--color-surface)",
        border: "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
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
        if (dragMoved.current || busy || editing) return;
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
              <CardBack
                entry={entry}
                onNoteSave={onNoteSave}
                onEditing={setEditing}
              />
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
            <CardBack
              entry={entry}
              onNoteSave={onNoteSave}
              onEditing={setEditing}
            />
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
              backgroundColor: "var(--color-surface)",
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
              // Same inversion problem as the button it mirrors — the green flips between themes.
              color: "var(--color-btn-label)",
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
        backgroundColor: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
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
 *
 * Three bands, not a top-aligned stack. The labels are four short lines and the card is a fixed
 * 4:5 box, so stacking everything at the top left roughly seventy percent of the face empty and
 * made the note — the one thing here the student writes — a thin row lost in it. The note now takes
 * the space instead: a well that grows to fill whatever the header does not use, which is also what
 * makes "add a note" read as somewhere to write rather than a link someone forgot to style.
 */
function CardBack({
  entry,
  onNoteSave,
  onEditing,
}: {
  entry: NotebookEntryDto;
  onNoteSave: (note: string | null) => Promise<void>;
  onEditing: (editing: boolean) => void;
}) {
  const t = useTranslations("notebook");
  const label = entry.topicName ?? entry.subjectName;
  const answered = entry.communityAnsweredAt && entry.communityThreadId;

  return (
    <div className="flex size-full flex-col gap-4 p-5">
      <div className="flex flex-col gap-2">
        <span
          className="text-lg font-bold text-balance"
          style={{ color: "var(--color-main)" }}
        >
          {label ?? t("card_unlabelled")}
        </span>

        {/* One pill shape for both, so the row reads as one band of metadata. Only the error type
            is tinted — it is the classification the student chose; the review count is a fact
            about the card, and giving it the same colour would make two things look equally
            meaningful when they are not. */}
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
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                color: "var(--color-secondary)",
                backgroundColor: "var(--color-surface-container)",
              }}
            >
              <RotateCw aria-hidden size={12} />
              {t("card_review_count", { count: entry.reviewCount })}
            </span>
          ) : null}
        </div>
      </div>

      <NoteField entry={entry} onSave={onNoteSave} onEditing={onEditing} />

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

/**
 * The student's own note about the mistake, editable right here.
 *
 * The note used to be write-once, filled in when the card was filed. But the moment a card catches
 * you a second time is the moment you actually learn what went wrong — and until now there was
 * nowhere to put that. Review is when the note is born, not when the entry is.
 *
 * ponytail: explicit save, not save-on-blur. This sits on a card that can be swiped away or flipped
 * out from under it; blurring is one of the ways the text disappears, so it cannot also be the way
 * it is committed.
 */
function NoteField({
  entry,
  onSave,
  onEditing,
}: {
  entry: NotebookEntryDto;
  onSave: (note: string | null) => Promise<void>;
  onEditing: (editing: boolean) => void;
}) {
  const t = useTranslations("notebook");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.note ?? "");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function open() {
    setDraft(entry.note ?? "");
    setFailed(false);
    setEditing(true);
    // The card owns drag and flip; both have to stand down while a caret is in here, or the first
    // gesture inside the textarea answers the card or turns it face-away mid-sentence.
    onEditing(true);
  }

  function close() {
    setEditing(false);
    onEditing(false);
  }

  /** The well both states share, so opening the editor does not resize or move the note area. */
  const wellClass =
    "flex min-h-0 flex-1 flex-col rounded-[var(--radius-card)] p-3";
  const wellStyle = {
    backgroundColor: "var(--color-surface-container)",
    border: "1px solid color-mix(in srgb, var(--color-main) 8%, transparent)",
  } as const;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
        className={`${wellClass} group w-full cursor-pointer gap-2 text-left outline-none transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--color-main)_20%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none`}
        style={wellStyle}
      >
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "var(--color-secondary)" }}
        >
          <Pencil aria-hidden size={12} />
          {entry.note ? t("review_note_edit") : t("review_note_add")}
        </span>
        <span
          className="overflow-y-auto text-sm text-pretty"
          style={{
            color: entry.note ? "var(--color-body)" : "var(--color-secondary)",
          }}
        >
          {entry.note ?? t("review_note_placeholder")}
        </span>
      </button>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-2"
      onClick={(event) => event.stopPropagation()}
    >
      <textarea
        autoFocus
        maxLength={NOTEBOOK_NOTE_MAX_LENGTH}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-label={t("review_note_edit")}
        placeholder={t("review_note_placeholder")}
        className={`${wellClass} resize-none text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]`}
        style={{ ...wellStyle, color: "var(--color-main)" }}
      />
      {failed ? <FormError message={t("error_note_save")} /> : null}
      <div className="flex gap-2">
        <NotebookCompactButton
          busy={busy}
          onClick={() => {
            setBusy(true);
            setFailed(false);
            const trimmed = draft.trim();
            void onSave(trimmed.length > 0 ? trimmed : null)
              .then(close)
              .catch(() => setFailed(true))
              .finally(() => setBusy(false));
          }}
        >
          {t("review_note_save")}
        </NotebookCompactButton>
        <NotebookCompactButton
          variant="secondary"
          disabled={busy}
          onClick={close}
        >
          {t("review_note_cancel")}
        </NotebookCompactButton>
      </div>
    </div>
  );
}
