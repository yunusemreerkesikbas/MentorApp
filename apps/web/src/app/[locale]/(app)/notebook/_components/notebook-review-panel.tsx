"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  CalendarClock,
  Check,
  FileText,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  LoaderCircle,
  RotateCcw,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";
import { Button, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { NotebookCompactButton } from "@/components/notebook/notebook-compact-button";
import { NotebookImageLightbox } from "@/components/notebook/notebook-image-lightbox";
import { reviewNotebookEntry, updateNotebookEntry } from "@/lib/notebook";
import { putNotebookHandoff } from "@/lib/notebook-handoff";
import {
  bySubject,
  nextUnansweredIndex,
  reviewFeedback,
  type ReviewFeedback,
} from "@/lib/notebook-review-deck";
import {
  NotebookReviewCard,
  REVIEW_CARD_BOX,
  REVIEW_CARD_WIDTH,
} from "./notebook-review-card";
import { NotebookReviewList } from "./notebook-review-list";

interface NotebookReviewPanelProps {
  entries: NotebookEntryDto[];
  onReviewed: (entry: NotebookEntryDto) => void;
  /**
   * An entry changed without being reviewed (the note edited on a card back). Separate from
   * `onReviewed` on purpose: that one also drops the card from the due list, which a note edit
   * must not do.
   */
  onEntryUpdated?: (entry: NotebookEntryDto) => void;
  /**
   * Opens the card's settings — labels and deletion. Passed only when the panel is showing a single
   * card the student opened deliberately, never for the due deck: a review session is not a place
   * where a card should be able to disappear.
   */
  onEdit?: (entry: NotebookEntryDto) => void;
  onClose: () => void;
}

/**
 * The review loop: a deck of flashcards, one question at a time, two answers.
 *
 * A card, not a checklist. A list invites skimming and ticking; a single card asks the student to
 * actually look at the question again, which is the only part of this feature that changes a net.
 * Progress is "3 / 7" rather than a percentage bar for the same reason — a bar rewards finishing, a
 * counter just says where you are. There is deliberately no running tally of right and wrong
 * answers either: "çözemedim" costs a shorter interval and nothing else, and a scoreboard climbing
 * beside the deck is how a review flow teaches students to lie to it. The list view is navigation
 * only, for the same reason (`NotebookReviewList`).
 *
 * The panel owns the deck; `NotebookReviewCard` owns one card. What used to be two card shells
 * here (photo / text-only) is now the card's own concern, and what used to overlay the photo —
 * subject, error type, review count, note — moved to the back of the card, where it stops
 * spoiling the question it sits on top of.
 *
 * Actions live *under* the card rather than in a gradient bar across it. The bar covered the
 * bottom of the question, which is the one thing on screen that must stay readable, and buttons
 * that belong to the review rather than to a face do not need to be duplicated per side.
 *
 * Swipe and the two buttons answer; the arrow pair beside them only moves the cursor. A student who
 * cannot face a card right now has to be able to put it down without lying to the scheduler, and the
 * list view only covers that on a deck big enough to show the list toggle. ←/→ drive the arrows,
 * not the answers: the keys have to mean what the controls next to them mean, and answering stays
 * reachable from the keyboard through the buttons themselves.
 */
export function NotebookReviewPanel({
  entries,
  onReviewed,
  onEntryUpdated,
  onEdit,
  onClose,
}: NotebookReviewPanelProps) {
  const t = useTranslations("notebook");
  const reduceMotion = useReducedMotion();

  /**
   * The deck is taken once, when the panel opens, and never reshuffled under the student.
   *
   * `entries` is the shell's live due list, and answering removes the card from it — so walking
   * `entries` directly meant every answer shrank the array while the cursor moved forward, and the
   * deck skipped the card after each one. A session is a fixed set of cards; which of them still
   * count as due is the shell's business, and it keeps that in its own state.
   */
  const [deck, setDeck] = useState(() => bySubject(entries));
  const [index, setIndex] = useState(0);
  /** Answered in *this* session — what stops the list offering a second review of the same card. */
  const [answered, setAnswered] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  /**
   * What this session actually did, in answer order — the closing screen's only source.
   *
   * A solved tally was enough while the summary was one sentence. It is not enough to say *which*
   * cards caught the student again, and that list is the one part of the summary that tells them
   * something they could not have counted themselves.
   */
  const [outcomes, setOutcomes] = useState<
    readonly { entry: NotebookEntryDto; solved: boolean }[]
  >([]);
  /**
   * The one line the deck says back after an answer, cleared on a timer.
   *
   * Held here rather than in the card: the card it describes is already flying off screen by the
   * time it is read, and a message that unmounts with its subject is a message nobody sees.
   */
  const [feedback, setFeedback] = useState<ReviewFeedback>(null);
  /** Which way the answered card flies out — +1 solved (right), -1 missed (left). */
  const [direction, setDirection] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  /** Full-size photo, opened from the card. Owned here so Escape can be handed to it cleanly. */
  const [zoomed, setZoomed] = useState<NotebookEntryDto | null>(null);
  /**
   * Set when the student misses a card they had already got right once. That second miss is the
   * moment they have proved they are stuck — and the moment they will accept help. Offering the
   * community on the *first* miss would be offering it to everyone, every time, which is noise.
   */
  const [stuck, setStuck] = useState<NotebookEntryDto | null>(null);
  /**
   * Set when the student leaves with cards still in the deck — the summary then reports what they
   * left rather than pretending the day is over.
   */
  const [exited, setExited] = useState(false);

  const entry = index >= 0 ? deck[index] : undefined;

  /** Where the deck goes once `id` is answered — wraps back for anything jumped over. */
  const advance = useCallback(
    (id: string) => {
      const next = new Set(answered);
      next.add(id);
      setAnswered(next);
      setIndex(
        nextUnansweredIndex(
          deck.map((card) => card.id),
          next,
          index,
        ),
      );
    },
    [answered, deck, index],
  );

  /**
   * Leaving. Shows the summary when there is something to report, closes outright when there is not.
   *
   * The guard matters more than the screen: putting a report in front of someone who opened the deck
   * and immediately changed their mind is how a close button stops being a close button. One
   * answered card is the whole bar — below it there is nothing to summarise anyway.
   */
  const leave = useCallback(() => {
    if (outcomes.length > 0 && index >= 0) setExited(true);
    else onClose();
  }, [index, onClose, outcomes.length]);

  /** Jump to a card by id rather than by position — the list and the deck are the same array. */
  const pickCard = useCallback(
    (id: string) => {
      setIndex(deck.findIndex((card) => card.id === id));
      setListOpen(false);
    },
    [deck],
  );

  /**
   * Move the cursor without answering, skipping anything already done and wrapping at both ends.
   *
   * ponytail: one function for both arrows. "Previous" on a deck that wraps is just `step(-1)`, and
   * a second copy walking the other way is the same loop with two signs flipped.
   */
  const step = useCallback(
    (delta: number) => {
      const ids = deck.map((card) => card.id);
      if (ids.length === 0) return;
      let cursor = index;
      for (let n = 0; n < ids.length; n += 1) {
        cursor = (cursor + delta + ids.length) % ids.length;
        if (!answered.has(ids[cursor]!)) {
          setDirection(delta);
          setIndex(cursor);
          return;
        }
      }
    },
    [answered, deck, index],
  );

  const answer = useCallback(
    async (solved: boolean) => {
      if (!entry) return;
      setBusy(true);
      setError(null);
      setDirection(solved ? 1 : -1);
      try {
        const wasProgressing = entry.reviewCount > 0;
        const updated = await reviewNotebookEntry(entry.id, solved);
        onReviewed(updated);
        setOutcomes((current) => [...current, { entry: updated, solved }]);
        // The days come from the entry the server returned, never from a copy of the ladder here:
        // two sources for one schedule is one that drifts on the next policy change.
        setFeedback(reviewFeedback(updated));
        // The answer landed either way, so the card is done for this session before the stuck
        // screen takes over — otherwise skipping past it would offer the same card again.
        advance(entry.id);
        if (!solved && wasProgressing && !updated.communityThreadId) {
          setStuck(updated);
        }
      } catch {
        setError(t("error_review"));
      } finally {
        setBusy(false);
      }
    },
    [advance, entry, onReviewed, t],
  );

  /**
   * The note the student writes *during* review — the moment they actually work out what went
   * wrong. Rejects on failure so the field can say so without the card losing what was typed.
   */
  const patchEntry = useCallback(
    async (patch: Parameters<typeof updateNotebookEntry>[1]) => {
      if (!entry) return;
      const updated = await updateNotebookEntry(entry.id, patch);
      setDeck((current) =>
        current.map((card) => (card.id === updated.id ? updated : card)),
      );
      onEntryUpdated?.(updated);
    },
    [entry, onEntryUpdated],
  );

  const saveNote = useCallback(
    (note: string | null) => patchEntry({ note }),
    [patchEntry],
  );

  /** The answer is usually learned at the moment the card catches you — same path as the note. */
  const saveSolutionNote = useCallback(
    (solutionNote: string | null) => patchEntry({ solutionNote }),
    [patchEntry],
  );

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // The lightbox owns the keyboard while it is open — otherwise one Escape closes both, and an
      // arrow key answers a card the student is only looking at.
      if (zoomed) return;
      if (event.key === "Escape") {
        // Escape backs out one layer at a time: the list first, the whole review only once the
        // student is looking at a card again.
        if (listOpen) setListOpen(false);
        else leave();
        return;
      }
      if (listOpen || busy || stuck || !entry) return;
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, entry, leave, listOpen, step, stuck, zoomed]);

  /** Answered cards fly out the way they were sent; the next one rises from the stack behind. */
  const cardVariants = {
    enter: reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 14 },
    center: { opacity: 1, scale: 1, y: 0, x: 0, rotate: 0 },
    exit: (dir: number) =>
      reduceMotion
        ? { opacity: 0 }
        : { opacity: 0, x: dir * 560, rotate: dir * 12 },
  };

  const remaining = deck.filter((card) => !answered.has(card.id)).length;

  return (
    <AnimatePresence>
      <motion.div
        key="notebook-review"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/70 p-4 backdrop-blur-md"
        onClick={leave}
        role="dialog"
        aria-modal="true"
        aria-label={t("review_title")}
      >
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          {deck.length > 1 && !stuck && entry ? (
            <OverlayControl
              label={listOpen ? t("review_list_close") : t("review_list")}
              pressed={listOpen}
              onClick={() => setListOpen((current) => !current)}
            >
              <LayoutList aria-hidden size={19} strokeWidth={2.25} />
            </OverlayControl>
          ) : null}
          {onEdit && entry ? (
            <OverlayControl
              label={t("entry_edit_title")}
              onClick={() => onEdit(entry)}
            >
              <Settings2 aria-hidden size={19} strokeWidth={2.25} />
            </OverlayControl>
          ) : null}
          <OverlayControl label={t("card_preview_close")} onClick={leave}>
            <X aria-hidden size={19} strokeWidth={2.25} />
          </OverlayControl>
        </div>

        {stuck || exited || !entry ? (
          <div
            // Same column as the cards. At `max-w-xl` these two screens were 160px wider than the
            // deck they interrupt, so the modal visibly changed shape at exactly the two moments
            // the student is being told something.
            className={`flex ${REVIEW_CARD_WIDTH} flex-col overflow-hidden rounded-[var(--radius-card)]`}
            style={{
              background: "var(--color-surface)",
              border:
                "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
              boxShadow: "var(--shadow-card)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {stuck ? (
              <StuckPanel entry={stuck} onSkip={() => setStuck(null)} />
            ) : (
              <DonePanel
                total={deck.length}
                outcomes={outcomes}
                // Only ever non-zero on the way out: a deck that ended on its own has no card left
                // to skip, so this is the number that makes "atlanan" mean anything at all.
                skipped={deck.length - outcomes.length}
                onClose={onClose}
              />
            )}
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            {/* No "N kart kaldı" chip over the list. The deck now *is* the count — nine slabs,
                two of them checked off — so the line was a caption reading out what the picture
                already shows, sitting where the filter chips need to be. */}
            {listOpen ? (
              <NotebookReviewList
                entries={deck}
                currentId={entry?.id ?? null}
                answered={answered}
                onPick={pickCard}
              />
            ) : (
              <>
                <div className="relative flex items-center justify-center">
                  {/* On the card's own top-left corner rather than a chip floating above the deck.
                      The chip cost a whole row of vertical space on a screen whose card is already
                      capped by viewport height, and a progress counter belongs to the card it is
                      counting. It sits outside the turning element, so it does not flip with it. */}
                  {deck.length > 1 ? (
                    <span
                      className="pointer-events-none absolute left-2 top-2 z-10 rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{
                        color: "var(--color-main)",
                        backgroundColor:
                          "color-mix(in srgb, var(--color-surface) 80%, transparent)",
                        boxShadow: "var(--shadow-card)",
                      }}
                    >
                      {t("review_progress", {
                        current: index + 1,
                        total: deck.length,
                      })}
                    </span>
                  ) : null}

                  {/* The rest of the deck, as one card peeking out behind the live one. Cheaper
                      than a real stack and says the same thing: there is more after this. */}
                  {/* The rest of the deck, as two cards fanned out behind the live one.
                      Cheaper than a real stack and says the same thing — there is more after this —
                      but *aligned* copies said it badly: a card squarely behind another reads as a
                      drop shadow, not as a second card. The tilt is what makes it a pile. */}
                  {STACK_LAYERS.filter((layer) => remaining > layer.after).map(
                    (layer) => (
                      <div
                        key={layer.after}
                        aria-hidden
                        className={`pointer-events-none absolute ${REVIEW_CARD_BOX} rounded-[var(--radius-card)]`}
                        style={{
                          // Same surface as the live card. They were tinted while the front was
                          // tinted too; once the photo front went back to plain surface, a coloured
                          // pile behind a colourless card was just an inconsistency. What makes them
                          // read as cards is the tilt, not a fill.
                          backgroundColor: "var(--color-surface)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
                          boxShadow: "var(--shadow-card)",
                          opacity: layer.opacity,
                          // Rotate last, scale first (CSS applies these right to left), so the
                          // offset is not eaten by the shrink and the tilt pivots on the card's own
                          // middle rather than swinging it sideways.
                          transform: `translateY(${layer.y}px) rotate(${layer.rotate}deg) scale(${layer.scale})`,
                        }}
                      />
                    ),
                  )}

                  <AnimatePresence
                    mode="wait"
                    custom={direction}
                    initial={false}
                  >
                    <motion.div
                      key={entry.id}
                      custom={direction}
                      variants={cardVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{
                        duration: reduceMotion ? 0 : 0.28,
                        ease: "easeOut",
                      }}
                      className="relative"
                    >
                      <NotebookReviewCard
                        entry={entry}
                        busy={busy}
                        onSolved={() => void answer(true)}
                        onMissed={() => void answer(false)}
                        onZoom={entry.url ? () => setZoomed(entry) : null}
                        onNoteSave={saveNote}
                        onSolutionNoteSave={saveSolutionNote}
                        onSolutionZoom={
                          entry.solutionUrl
                            ? () =>
                                setZoomed({ ...entry, url: entry.solutionUrl })
                            : null
                        }
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className={`flex ${REVIEW_CARD_WIDTH} flex-col gap-3`}>
                  <FormError message={error} />

                  {/* What the last answer actually did — the thing the deck used to be silent
                      about. A fixed-height slot, empty or not: letting it collapse would bounce the
                      button row on every answer, and the buttons are where the thumb is aiming.
                      `aria-live` announces it without taking focus off the deck. */}
                  <p
                    aria-live="polite"
                    className="flex h-5 items-center justify-center gap-1.5 text-center text-xs font-semibold"
                    style={{
                      color:
                        feedback?.kind === "healed"
                          ? "var(--color-success)"
                          : "rgba(255,255,255,0.75)",
                    }}
                  >
                    {feedback?.kind === "healed" ? (
                      <>
                        <Sparkles aria-hidden size={13} />
                        {t("review_feedback_healed")}
                      </>
                    ) : feedback?.kind === "due" ? (
                      <>
                        <CalendarClock aria-hidden size={13} />
                        {t("review_feedback_due", { days: feedback.days })}
                      </>
                    ) : null}
                  </p>

                  {/* Four glyphs and no prose. The words moved into the hover/focus tooltip each
                      button carries: on the deck they were four labels competing with the card, and
                      after the first card nobody reads them again — but a glyph nobody can name yet
                      still has to be nameable, which is what the tooltip and the aria-label are for.
                      Weight, not colour, is what separates the pair from the arrows: the verdicts
                      are 60px and centred, the arrows 44px and pushed to the margins. */}
                  <div className="flex items-center justify-center gap-3">
                    <DeckButton
                      label={t("review_prev")}
                      variant="ghost"
                      disabled={busy || remaining < 2}
                      onClick={() => step(-1)}
                    >
                      <ChevronLeft aria-hidden size={22} strokeWidth={2.25} />
                    </DeckButton>

                    <div className="flex items-center gap-4 px-2">
                      <DeckButton
                        label={t("review_missed")}
                        variant="missed"
                        disabled={busy}
                        onClick={() => void answer(false)}
                      >
                        <RotateCcw aria-hidden size={24} strokeWidth={2.25} />
                      </DeckButton>
                      <DeckButton
                        label={t("review_solved")}
                        variant="solved"
                        disabled={busy}
                        onClick={() => void answer(true)}
                      >
                        {busy ? (
                          <LoaderCircle
                            aria-hidden
                            size={24}
                            strokeWidth={2.5}
                            className="animate-spin motion-reduce:animate-none"
                          />
                        ) : (
                          <Check aria-hidden size={26} strokeWidth={2.75} />
                        )}
                      </DeckButton>
                    </div>

                    <DeckButton
                      label={t("review_next")}
                      variant="ghost"
                      disabled={busy || remaining < 2}
                      onClick={() => step(1)}
                    >
                      <ChevronRight aria-hidden size={22} strokeWidth={2.25} />
                    </DeckButton>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Rendered inside the dialog so its Escape and backdrop belong to this screen, not to the
            notebook page underneath — the deck stays exactly where it was when it closes. */}
        <NotebookImageLightbox entry={zoomed} onClose={() => setZoomed(null)} />
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Every control under the card: the two verdicts and the two arrows that move past one.
 *
 * One component because the four are one row and have to line up — same ring, same disabled
 * treatment, same tooltip — and three near-identical button bodies is how a row drifts out of
 * alignment on the next edit. What differs is only weight, which is the whole point: `solved` is a
 * filled disc, `missed` an outlined one the same size, and `ghost` is smaller and quieter, because
 * an arrow that looked like a verdict would invite walking the deck without grading a single card.
 *
 * ponytail: the tooltip is a sibling span on `group-hover` / `group-focus-visible`, not a floating
 * library. It has one placement (above), never flips, and lives inside a fixed dialog with room
 * over it — every reason to reach for a positioning engine is absent here. It is `aria-hidden`; the
 * accessible name is the `aria-label`, so the two never disagree.
 */
function DeckButton({
  label,
  variant,
  disabled,
  onClick,
  children,
}: {
  label: string;
  variant: "solved" | "missed" | "ghost";
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const verdict = variant !== "ghost";
  const style =
    variant === "solved"
      ? {
          // Same inversion the card's swipe cue handles: the success green flips between themes,
          // so the glyph on top of it takes the button label colour rather than a literal white.
          backgroundColor: "var(--color-success)",
          color: "var(--color-btn-label)",
          border: "1px solid transparent",
          boxShadow:
            "0 8px 24px color-mix(in srgb, var(--color-success) 35%, transparent)",
        }
      : variant === "missed"
        ? {
            // Outlined and never red. Missing a card costs a shorter interval, not a scolding —
            // the same reasoning as the swipe cue it mirrors.
            backgroundColor: "rgba(255,255,255,0.10)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.45)",
          }
        : {
            backgroundColor: "rgba(255,255,255,0.12)",
            color: "#ffffff",
            border: "1px solid transparent",
          };

  return (
    <div className="group relative flex">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`flex ${
          verdict ? "size-[60px]" : "size-11"
        } shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100`}
        style={style}
      >
        {children}
      </button>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
        style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#ffffff" }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * The two cards drawn behind the live one, furthest first.
 *
 * Fixed values, not jitter: a random tilt per render is a pile that rearranges itself every time
 * React re-runs, and "the deck moved on its own" is a bug report. `after` is how many cards must
 * still be unanswered for that layer to be worth drawing — no point promising two more cards when
 * there is one.
 */
/**
 * How long the answer line stays up.
 *
 * Long enough to read six words after the eye has followed a card off screen, short enough that it
 * is gone before the next answer needs the slot. It is not dismissible: nothing here is worth a
 * close button, and a message that outlives its card is worse than one that leaves early.
 */
const FEEDBACK_MS = 2200;

const STACK_LAYERS = [
  { after: 2, y: 26, rotate: 3.5, scale: 0.93, opacity: 0.45 },
  { after: 1, y: 14, rotate: -2.5, scale: 0.965, opacity: 0.7 },
];

/** Round control floating on the backdrop — close, and the list toggle beside it. */
function OverlayControl({
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
    <div className="group relative flex">
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full text-white outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-white active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
        style={{
          background: pressed
            ? "rgba(255,255,255,0.32)"
            : "rgba(255,255,255,0.15)",
        }}
      >
        {children}
      </button>
      {/* Below and right-aligned, for the same reason as the card's own controls: the row is pinned
          to the top-right of the viewport, so a centred label on the last button runs off-screen. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-full mt-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
        style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#ffffff" }}
      >
        {label}
      </span>
    </div>
  );
}

function StuckPanel({
  entry,
  onSkip,
}: {
  entry: NotebookEntryDto;
  onSkip: () => void;
}) {
  const t = useTranslations("notebook");
  return (
    <div className="flex flex-col gap-4 p-6">
      <SectionHeading as="h2" subtitle={t("stuck_subtitle")}>
        {t("stuck_title")}
      </SectionHeading>
      {/*
        A handoff, not a silent post. Which zone a question belongs in depends on what the user has
        joined, and publishing on somebody's behalf from a side panel is the wrong shape for an
        action that puts their photo in front of strangers -- copyright warning included.
      */}
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("stuck_copyright")}
      </p>
      <div className="flex flex-wrap gap-2">
        {/*
          The entry id rides along so the question the student is about to ask can be linked back
          to this card. Until now the handoff dropped them at the community with nothing carried
          over: they asked, the thread was never attached, and the card's own "answered in the
          community" state could never happen. The feed is the destination rather than the hub
          because that is where the question composer lives.
        */}
        <Link
          href={{
            pathname: "/community/feed",
            query: { notebookEntry: entry.id },
          }}
          // The other door into the same composer — it has to leave the same note behind, or the
          // banner appears for one route and not the other.
          onClick={() =>
            putNotebookHandoff({
              entryId: entry.id,
              label:
                [entry.subjectName, entry.topicName]
                  .filter(Boolean)
                  .join(" · ") || t("card_unlabelled"),
              errorTypeLabel: t(`error_type.${entry.errorType}`),
              photo:
                entry.storageKey && entry.url
                  ? { storageKey: entry.storageKey, url: entry.url }
                  : undefined,
            })
          }
          className="flex min-h-11 items-center justify-center rounded-[var(--radius-card)] px-4 text-sm font-bold text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ backgroundColor: "var(--color-btn)" }}
        >
          {t("stuck_ask")}
        </Link>
        <NotebookCompactButton variant="secondary" large onClick={onSkip}>
          {t("stuck_skip")}
        </NotebookCompactButton>
      </div>
    </div>
  );
}

/**
 * The closing screen, with what the session actually came to.
 *
 * A tally at the *end* is not the running scoreboard the deck deliberately refuses: mid-deck it
 * would price every honest "çözemedim", here it is just what happened. Which is also why there is
 * no percentage and no ring. The denominator here is the student's own mistakes, so a low number
 * means the notebook is full, not that they failed — and a visible ratio driven by a self-reported
 * button with no external grader teaches exactly one lesson: press the green one. That lie then
 * rides the ladder to 21 days and out of the rotation, which is the disappearing card nobody wants.
 *
 * The cards that were missed are named rather than counted. "3 kart" is arithmetic the student
 * could do themselves; "Matematik · Permütasyon, işlem hatası" is the only thing on this screen
 * they could not have known without it.
 */
function DonePanel({
  total,
  outcomes,
  skipped,
  onClose,
}: {
  total: number;
  outcomes: readonly { entry: NotebookEntryDto; solved: boolean }[];
  /** Cards left in the deck — always 0 unless the student walked out mid-session. */
  skipped: number;
  onClose: () => void;
}) {
  const t = useTranslations("notebook");
  const solved = outcomes.filter((outcome) => outcome.solved).length;
  const healed = outcomes.filter(
    (outcome) => outcome.entry.status === "HEALED",
  ).length;
  const missed = outcomes
    .filter((outcome) => !outcome.solved)
    .map((outcome) => outcome.entry);
  const unfinished = skipped > 0;

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* The count *is* the subtitle. "Tekrar edilecek soru kalmadı" said the same thing one line
          above "3 karttan 2 tanesini çözdün", so the screen opened by telling the student the same
          news twice — once vaguely, once with the numbers. */}
      {/* The subtitle is a count only while a count is good news. "1 karttan 0 tanesini çözdün"
          is a scoreline read out to someone who just told the truth about a card they missed — and
          on a one-card deck it is the entire screen. With nothing solved it says what happens next
          instead, which is the honest half of the same fact and the half that is actually useful. */}
      <SectionHeading
        as="h2"
        subtitle={
          unfinished
            ? t("review_exit_summary", { answered: outcomes.length, skipped })
            : solved > 0
              ? t("review_done_summary", { total, solved })
              : t("review_done_none", { count: outcomes.length })
        }
      >
        {unfinished ? t("review_exit_title") : t("review_done_title")}
      </SectionHeading>

      {/* Its own band, not a line of text. A card leaving the rotation is the rarest thing that
          happens in this feature — three correct answers spread over a month — and it is the only
          event here worth marking rather than reporting. */}
      {healed > 0 ? (
        <p
          className="flex items-center gap-2 rounded-[var(--radius-card)] px-3 py-2.5 text-sm font-bold"
          style={{
            color: "var(--color-success)",
            backgroundColor:
              "color-mix(in srgb, var(--color-success) 14%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--color-success) 30%, transparent)",
          }}
        >
          <Sparkles aria-hidden size={16} />
          {t("review_done_healed", { count: healed })}
        </p>
      ) : null}

      {missed.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span
            className="text-xs font-bold"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("review_done_missed_title")}
          </span>
          {missed.map((entry) => (
            <MissedRow key={entry.id} entry={entry} />
          ))}
        </div>
      ) : null}

      <Button fullWidth onClick={onClose}>
        {t("review_close")}
      </Button>
    </div>
  );
}

/**
 * One card that caught the student again — what it was, when it comes back, and the way out.
 *
 * The row *is* the link, for a card nobody has asked about yet. `StuckPanel` already offers this
 * mid-deck on a second miss, but only for the one card and only in the moment; here it is the whole
 * list, at the point where the student has stopped answering and can actually consider it. A card
 * that already has a thread is not offered again — it is waiting on an answer, not on them.
 *
 * The photo carries the identity. Half these rows say "Etiketsiz" — a card filed in a hurry with no
 * subject — and a list of identical labels is a list of nothing; the thumbnail is what makes it
 * *that* question. The return day is here for the same reason it is on the deck: the card is
 * scheduled, not spent, and the summary is the last chance to say so.
 */
function MissedRow({ entry }: { entry: NotebookEntryDto }) {
  const t = useTranslations("notebook");
  const errorTypeLabel = t(`error_type.${entry.errorType}`);
  const label =
    [entry.subjectName, entry.topicName].filter(Boolean).join(" · ") ||
    t("card_unlabelled");
  const feedback = reviewFeedback(entry);

  const body = (
    <>
      <span
        className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)]"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        {entry.url ? (
          <Image
            src={entry.url}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
            unoptimized
          />
        ) : (
          // A text-only entry, not a broken image — a struck-through icon would read as an error on
          // a card where having no photo is perfectly normal.
          <FileText
            aria-hidden
            size={15}
            style={{ color: "var(--color-secondary)" }}
          />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span
          className="truncate text-sm font-semibold"
          style={{ color: "var(--color-main)" }}
        >
          {label}
        </span>
        <span
          className="truncate text-xs"
          style={{ color: "var(--color-secondary)" }}
        >
          {feedback?.kind === "due"
            ? `${errorTypeLabel} · ${t("review_done_returns", { days: feedback.days })}`
            : errorTypeLabel}
        </span>
      </span>

      {!entry.communityThreadId ? (
        <span
          className="shrink-0 text-xs font-bold"
          style={{ color: "var(--color-accent)" }}
        >
          {t("review_done_ask")}
        </span>
      ) : null}
    </>
  );

  const shell =
    "flex min-h-11 items-center gap-3 rounded-[var(--radius-card)] px-3 py-2";
  const style = { backgroundColor: "var(--color-surface-container)" } as const;

  if (entry.communityThreadId) {
    return (
      <div className={shell} style={style}>
        {body}
      </div>
    );
  }

  return (
    <Link
      href={{ pathname: "/community/feed", query: { notebookEntry: entry.id } }}
      // Left on the way out, read on arrival. The composer has no way to look this card up — there
      // is no endpoint for a single entry — and this screen is holding it already.
      onClick={() =>
        putNotebookHandoff({
          entryId: entry.id,
          label,
          errorTypeLabel,
          // Only the question. The solution photo stays in the notebook: posting the answer key
          // alongside the question is not asking for help, it is answering yourself in public.
          photo:
            entry.storageKey && entry.url
              ? { storageKey: entry.storageKey, url: entry.url }
              : undefined,
        })
      }
      className={`${shell} outline-none transition-colors duration-150 hover:bg-[var(--color-accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none`}
      style={style}
    >
      {body}
    </Link>
  );
}
