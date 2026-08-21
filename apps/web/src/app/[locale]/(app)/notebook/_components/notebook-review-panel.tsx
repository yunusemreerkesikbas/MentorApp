"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LayoutList, Settings2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";
import { Button, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { NotebookCompactButton } from "@/components/notebook/notebook-compact-button";
import { NotebookImageLightbox } from "@/components/notebook/notebook-image-lightbox";
import { reviewNotebookEntry, updateNotebookEntry } from "@/lib/notebook";
import { nextUnansweredIndex } from "@/lib/notebook-review-deck";
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
 * ponytail: swipe answers, so the old prev/next arrows are gone and ←/→ answer instead. Browsing a
 * due deck without answering was navigation for its own sake; "sonra" is the X in the corner, and
 * jumping to a specific card is what the list is for.
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
  const [fullDeck, setFullDeck] = useState(entries);
  const [index, setIndex] = useState(0);
  /**
   * Study one subject at a time. A twenty-card deck that jumps between Matematik and Tarih on every
   * turn is worse than eight cards of one thing, and the list already knows how to group them.
   *
   * ponytail: the filter is a subject *name*, and the "no subject yet" group is not offered as one.
   * Wrapping the value just to distinguish "no filter" from "filter to the unlabelled ones" would
   * be machinery for a deck nobody asks to study.
   */
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  /** Answered in *this* session — what stops the list offering a second review of the same card. */
  const [answered, setAnswered] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  /** Only the solved tally is kept — enough for the closing summary, and nothing is shown mid-deck. */
  const [solvedCount, setSolvedCount] = useState(0);
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

  // Derived, not copied: one deck in state, and the filter is a view of it. Copying would leave the
  // note-edit patch writing into whichever of the two the student is not looking at.
  const deck = subjectFilter
    ? fullDeck.filter((card) => card.subjectName === subjectFilter)
    : fullDeck;
  const entry = index >= 0 ? deck[index] : undefined;
  /** Across the whole session, not the filtered view — what decides whether the day is really over. */
  const remainingAll = fullDeck.filter((card) => !answered.has(card.id)).length;

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

  /** Switching subject restarts the cursor at the first card of the new view still unanswered. */
  const applyFilter = useCallback(
    (next: string | null) => {
      const nextDeck = next
        ? fullDeck.filter((card) => card.subjectName === next)
        : fullDeck;
      setSubjectFilter(next);
      setIndex(
        nextUnansweredIndex(
          nextDeck.map((card) => card.id),
          answered,
          -1,
        ),
      );
      setListOpen(false);
    },
    [answered, fullDeck],
  );

  /**
   * Jump to a card by id rather than by position: the list shows the whole deck while the deck
   * itself may be filtered, so an index would mean different cards on the two sides. Picking a card
   * outside the active filter clears the filter — the student pointed at it, so it wins.
   */
  const pickCard = useCallback(
    (id: string) => {
      const inView = deck.findIndex((card) => card.id === id);
      if (inView >= 0) {
        setIndex(inView);
      } else {
        setSubjectFilter(null);
        setIndex(fullDeck.findIndex((card) => card.id === id));
      }
      setListOpen(false);
    },
    [deck, fullDeck],
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
        if (solved) setSolvedCount((current) => current + 1);
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
      setFullDeck((current) =>
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
    const onKey = (event: KeyboardEvent) => {
      // The lightbox owns the keyboard while it is open — otherwise one Escape closes both, and an
      // arrow key answers a card the student is only looking at.
      if (zoomed) return;
      if (event.key === "Escape") {
        // Escape backs out one layer at a time: the list first, the whole review only once the
        // student is looking at a card again.
        if (listOpen) setListOpen(false);
        else onClose();
        return;
      }
      if (listOpen || busy || stuck || !entry) return;
      // Same mapping as the swipe, now that the arrows no longer browse the deck.
      if (event.key === "ArrowRight") void answer(true);
      if (event.key === "ArrowLeft") void answer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [answer, busy, entry, listOpen, onClose, stuck, zoomed]);

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
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-4"
        style={{ background: "rgba(0,0,0,0.85)" }}
        onClick={onClose}
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
              <LayoutList aria-hidden size={18} />
            </OverlayControl>
          ) : null}
          {onEdit && entry ? (
            <OverlayControl
              label={t("entry_edit_title")}
              onClick={() => onEdit(entry)}
            >
              <Settings2 aria-hidden size={18} />
            </OverlayControl>
          ) : null}
          <OverlayControl label={t("card_preview_close")} onClick={onClose}>
            <X aria-hidden size={18} />
          </OverlayControl>
        </div>

        {stuck || !entry ? (
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
            ) : subjectFilter && remainingAll > 0 ? (
              // The filtered view ran out, the day did not. Saying "bugünlük bu kadar" here would
              // be telling the student they are done while cards from other subjects are still due.
              <SubjectDonePanel
                subject={subjectFilter}
                remaining={remainingAll}
                onContinue={() => applyFilter(null)}
                onClose={onClose}
              />
            ) : (
              <DonePanel
                total={fullDeck.length}
                solved={solvedCount}
                onClose={onClose}
              />
            )}
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            {listOpen || deck.length > 1 || subjectFilter ? (
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  color: "#ffffff",
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
              >
                {listOpen
                  ? t("review_list_remaining", { count: remaining })
                  : subjectFilter
                    ? `${subjectFilter} · ${t("review_progress", {
                        current: index + 1,
                        total: deck.length,
                      })}`
                    : t("review_progress", {
                        current: index + 1,
                        total: deck.length,
                      })}
              </span>
            ) : null}

            {listOpen ? (
              <NotebookReviewList
                entries={fullDeck}
                currentId={entry?.id ?? null}
                answered={answered}
                subjectFilter={subjectFilter}
                onFilter={applyFilter}
                onPick={pickCard}
              />
            ) : (
              <>
                <div className="relative flex items-center justify-center">
                  {/* The rest of the deck, as one card peeking out behind the live one. Cheaper
                      than a real stack and says the same thing: there is more after this. */}
                  {remaining > 1 ? (
                    <div
                      aria-hidden
                      className={`pointer-events-none absolute ${REVIEW_CARD_BOX} rounded-[var(--radius-card)]`}
                      style={{
                        backgroundColor: "var(--color-surface)",
                        border:
                          "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
                        opacity: 0.55,
                        // Scale first, then push down (CSS applies these right to left), so the
                        // offset is not eaten by the shrink — at 0.95 the card loses ~11px of
                        // height, and a 22px translate is what leaves a visible sliver rather
                        // than a hairline.
                        transform: "translateY(22px) scale(0.95)",
                      }}
                    />
                  ) : null}

                  <AnimatePresence mode="wait" custom={direction} initial={false}>
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
                            ? () => setZoomed({ ...entry, url: entry.solutionUrl })
                            : null
                        }
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className={`flex ${REVIEW_CARD_WIDTH} flex-col gap-2`}>
                  <FormError message={error} />
                  <p
                    className="text-center text-xs"
                    style={{ color: "rgba(255,255,255,0.75)" }}
                  >
                    {reduceMotion
                      ? t("review_flip_hint")
                      : t("review_deck_hint")}
                  </p>
                  <div className="flex gap-2">
                    <NotebookCompactButton
                      variant="secondary"
                      onDark
                      large
                      disabled={busy}
                      onClick={() => void answer(false)}
                    >
                      {t("review_missed")}
                    </NotebookCompactButton>
                    <NotebookCompactButton
                      tone="success"
                      large
                      busy={busy}
                      onClick={() => void answer(true)}
                    >
                      {t("review_solved")}
                    </NotebookCompactButton>
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
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex size-11 cursor-pointer items-center justify-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{
        background: pressed ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.15)",
      }}
    >
      {children}
    </button>
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
 * would price every honest "çözemedim", here it is just what happened. Which is also why the cards
 * that were missed are described as still being in the rotation rather than counted as wrong — they
 * come back in a couple of days, and that is the whole design, not a penalty.
 */
function DonePanel({
  total,
  solved,
  onClose,
}: {
  total: number;
  solved: number;
  onClose: () => void;
}) {
  const t = useTranslations("notebook");
  const remaining = total - solved;
  return (
    <div className="flex flex-col gap-4 p-6">
      {/* The count *is* the subtitle. "Tekrar edilecek soru kalmadı" said the same thing one line
          above "3 karttan 2 tanesini çözdün", so the screen opened by telling the student the same
          news twice — once vaguely, once with the numbers. */}
      <SectionHeading
        as="h2"
        subtitle={t("review_done_summary", { total, solved })}
      >
        {t("review_done_title")}
      </SectionHeading>
      {remaining > 0 ? (
        <p className="text-sm text-pretty" style={{ color: "var(--color-body)" }}>
          {t("review_done_remaining", { count: remaining })}
        </p>
      ) : null}
      <Button fullWidth onClick={onClose}>
        {t("review_close")}
      </Button>
    </div>
  );
}

/**
 * One subject's cards are done while others are still waiting.
 *
 * Its own screen rather than the closing summary: `DonePanel` says the day is over, and saying that
 * with four Tarih cards still due would be the review flow telling the student a comfortable lie.
 * The way out is the same one they came in by — drop the filter and keep going.
 */
function SubjectDonePanel({
  subject,
  remaining,
  onContinue,
  onClose,
}: {
  subject: string;
  remaining: number;
  onContinue: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("notebook");
  return (
    <div className="flex flex-col gap-4 p-6">
      <SectionHeading
        as="h2"
        subtitle={t("review_subject_done_subtitle", { count: remaining })}
      >
        {t("review_subject_done_title", { subject })}
      </SectionHeading>
      <div className="flex flex-wrap gap-2">
        <NotebookCompactButton tone="success" large onClick={onContinue}>
          {t("review_subject_done_continue")}
        </NotebookCompactButton>
        <NotebookCompactButton variant="secondary" large onClick={onClose}>
          {t("review_close")}
        </NotebookCompactButton>
      </div>
    </div>
  );
}
