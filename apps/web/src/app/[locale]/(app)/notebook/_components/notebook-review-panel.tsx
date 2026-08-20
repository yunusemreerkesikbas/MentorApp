"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";
import { Button, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { NotebookCompactButton } from "@/components/notebook/notebook-compact-button";
import { reviewNotebookEntry } from "@/lib/notebook";

interface NotebookReviewPanelProps {
  entries: NotebookEntryDto[];
  onReviewed: (entry: NotebookEntryDto) => void;
  onClose: () => void;
}

/**
 * The review loop: one card at a time, one question, two buttons.
 *
 * A full-screen preview, not an inline card pushed into the page's own flow — the same shell
 * `NotebookImageLightbox` uses (fixed backdrop, Escape, click-away), because the question photo is
 * the whole point of this screen and an inline card was giving it a few hundred px in a sidebar-
 * width column with the rest of the page still visible around it. The photo box shrinks to the
 * image's own natural aspect ratio (a plain `<img>` capped by `max-height`/`max-width`, no `fill`)
 * rather than a fixed portrait box — a fixed box let a square or landscape photo letterbox inside
 * it, which is exactly the "black bars" problem `NotebookImageLightbox` avoids by never forcing an
 * aspect ratio either.
 *
 * Everything that used to sit *below* the photo in its own panel — the chip/topic/note info, the
 * question, the three answer buttons — now overlays it instead: info top-left, progress top-right,
 * question and buttons in a bottom gradient bar. One photo filling the screen with controls floating
 * on it reads as a preview; the same controls in a white strip glued to the bottom of a small photo
 * read as a form that happens to have a thumbnail. The top-left overlay mirrors
 * `NotebookEntryCard`'s own hover card — one visual language for "here's what this mistake is"
 * wherever it shows up. A text-only entry has no photo to overlay onto, so it keeps its info and
 * buttons as plain blocks in a bounded card instead.
 *
 * Deliberately not a checklist of everything due. A list invites skimming and ticking; a single
 * card asks the student to actually look at the question again, which is the only part of this
 * feature that changes a net. Progress is shown as "3 / 7" rather than a percentage bar for the
 * same reason — a bar rewards finishing, a counter just says where you are.
 *
 * "Çözemedim" is not a failure state and is never styled as one: it costs nothing but a shorter
 * interval, and a review flow that punishes honesty teaches the student to lie to it.
 */
export function NotebookReviewPanel({
  entries,
  onReviewed,
  onClose,
}: NotebookReviewPanelProps) {
  const t = useTranslations("notebook");
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  /** Which way the card slid in — drives the enter/exit side of the transition below. */
  const [direction, setDirection] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Set when the student misses a card they had already got right once. That second miss is the
   * moment they have proved they are stuck — and the moment they will accept help. Offering the
   * community on the *first* miss would be offering it to everyone, every time, which is noise.
   */
  const [stuck, setStuck] = useState<NotebookEntryDto | null>(null);

  const entry = entries[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function answer(solved: boolean) {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      const wasProgressing = entry.reviewCount > 0;
      const updated = await reviewNotebookEntry(entry.id, solved);
      onReviewed(updated);
      if (!solved && wasProgressing && !updated.communityThreadId) {
        setStuck(updated);
        return;
      }
      setDirection(1);
      setIndex((current) => current + 1);
    } catch {
      setError(t("error_review"));
    } finally {
      setBusy(false);
    }
  }

  const bounded = stuck != null || !entry || !entry.url;

  /** Slide direction lives on `custom` so an already-exiting card picks up the latest value too —
   *  framer-motion's documented pattern for a carousel, not a per-card prop. */
  const slideVariants = {
    enter: (dir: number) =>
      reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? 48 : -48 },
    center: { opacity: 1, x: 0 },
    exit: (dir: number) =>
      reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? -48 : 48 },
  };

  return (
    <AnimatePresence>
      <motion.div
        key="notebook-review"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.85)" }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={t("review_title")}
      >
        <button
          type="button"
          aria-label={t("card_preview_close")}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="absolute right-4 top-4 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <X aria-hidden size={18} />
        </button>

        {/* Browsing, not answering — these just move the pointer, they never call `answer()`.
            Hidden once the deck has produced a stuck/done screen, since there is nothing left to
            page between at that point. */}
        {!stuck && entry && entries.length > 1 ? (
          <>
            <button
              type="button"
              aria-label={t("previous_page")}
              disabled={index === 0}
              onClick={(event) => {
                event.stopPropagation();
                setDirection(-1);
                setIndex((current) => current - 1);
              }}
              className="absolute left-4 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <ChevronLeft aria-hidden size={20} />
            </button>
            <button
              type="button"
              aria-label={t("next_page")}
              disabled={index === entries.length - 1}
              onClick={(event) => {
                event.stopPropagation();
                setDirection(1);
                setIndex((current) => current + 1);
              }}
              className="absolute right-4 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <ChevronRight aria-hidden size={20} />
            </button>
          </>
        ) : null}

        {/*
          Two shells: a photo gets the full, borderless preview box (`h-[85vh]`, no rounded card
          chrome fighting the image for edge space) with everything overlaid on it. Anything without
          a photo to overlay onto — stuck, done, or a text-only entry — gets a normal bounded card,
          same as before.
        */}
        {bounded ? (
          <div
            className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-card)]"
            style={{ background: "var(--color-bg)" }}
            onClick={(event) => event.stopPropagation()}
          >
            {stuck ? (
              <StuckPanel
                onSkip={() => {
                  setStuck(null);
                  setIndex((current) => current + 1);
                }}
              />
            ) : !entry ? (
              <DonePanel onClose={onClose} />
            ) : (
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={entry.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    duration: reduceMotion ? 0 : 0.22,
                    ease: "easeOut",
                  }}
                >
                  <TextOnlyReviewCard
                    entry={entry}
                    busy={busy}
                    error={error}
                    progress={
                      entries.length > 1
                        ? { current: index + 1, total: entries.length }
                        : null
                    }
                    onSolved={() => void answer(true)}
                    onMissed={() => void answer(false)}
                    onLater={onClose}
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        ) : (
          <div
            // Shrinks to the photo's own rendered box (`w-fit`, capped by the `<img>`'s own
            // max-height/max-width) instead of a fixed portrait box the photo then letterboxes
            // inside. A background of its own is what keeps the rounded corners looking like a
            // card edge rather than a raw image edge.
            className="relative w-fit max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-card)]"
            style={{ backgroundColor: "var(--color-bg)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={entry.id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  duration: reduceMotion ? 0 : 0.22,
                  ease: "easeOut",
                }}
                className="relative"
              >
                <PhotoReviewCard
                  entry={entry}
                  busy={busy}
                  error={error}
                  progress={
                    entries.length > 1
                      ? { current: index + 1, total: entries.length }
                      : null
                  }
                  onSolved={() => void answer(true)}
                  onMissed={() => void answer(false)}
                  onLater={onClose}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function StuckPanel({ onSkip }: { onSkip: () => void }) {
  const t = useTranslations("notebook");
  return (
    <div className="flex flex-col items-start gap-3 p-5">
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
        <Link
          href="/community"
          className="flex min-h-9 items-center justify-center rounded-[var(--radius-card)] px-4 text-sm font-bold text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ backgroundColor: "var(--color-btn)" }}
        >
          {t("stuck_ask")}
        </Link>
        <NotebookCompactButton variant="secondary" onClick={onSkip}>
          {t("stuck_skip")}
        </NotebookCompactButton>
      </div>
    </div>
  );
}

function DonePanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("notebook");
  return (
    <div className="flex flex-col items-start gap-3 p-5">
      <SectionHeading as="h2" subtitle={t("review_done_subtitle")}>
        {t("review_done_title")}
      </SectionHeading>
      <Button onClick={onClose}>{t("review_close")}</Button>
    </div>
  );
}

interface ReviewCardProps {
  entry: NotebookEntryDto;
  busy: boolean;
  error: string | null;
  progress: { current: number; total: number } | null;
  onSolved: () => void;
  onMissed: () => void;
  onLater: () => void;
}

function ReviewActions({
  busy,
  onSolved,
  onMissed,
  onLater,
  onDark,
}: Pick<ReviewCardProps, "busy" | "onSolved" | "onMissed" | "onLater"> & {
  onDark?: boolean;
}) {
  const t = useTranslations("notebook");
  return (
    <div className="flex gap-2">
      <NotebookCompactButton busy={busy} onClick={onSolved}>
        {t("review_solved")}
      </NotebookCompactButton>
      <NotebookCompactButton
        variant="secondary"
        onDark={onDark}
        disabled={busy}
        onClick={onMissed}
      >
        {t("review_missed")}
      </NotebookCompactButton>
      <NotebookCompactButton
        variant="ghost"
        onDark={onDark}
        disabled={busy}
        onClick={onLater}
      >
        {t("review_later")}
      </NotebookCompactButton>
    </div>
  );
}

/** The full-preview shell: photo edge to edge, everything else floating on top of it. */
function PhotoReviewCard({
  entry,
  busy,
  error,
  progress,
  onSolved,
  onMissed,
  onLater,
}: ReviewCardProps) {
  const t = useTranslations("notebook");
  const label = entry.topicName ?? entry.subjectName;

  return (
    <>
      {/* A plain `<img>`, not `next/image fill` in a fixed-height box: the box below sizes itself
          to the image's own natural aspect ratio (`w-fit` + this element's intrinsic size), so a
          square or landscape photo no longer letterboxes inside a tall, portrait-shaped box. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- sizes to its own intrinsic aspect
          ratio; next/image's `fill` mode forces a caller-defined box shape instead. */}
      <img
        src={entry.url!}
        alt=""
        className="block max-h-[85vh] max-w-[min(92vw,900px)] w-auto"
      />

      {/* A small stats card, not a caption strip: a title row (what this mistake is) over a row of
          stat pills (why it was missed, how many times it's been reviewed) — the same tint the
          entry card's own hover overlay uses, just organised as data instead of one label. */}
      <div
        className="absolute left-3 top-3 flex max-w-[70%] flex-col gap-1.5 rounded-[var(--radius-card)] px-3 py-2.5"
        style={{ background: "rgba(17,17,17,0.6)" }}
      >
        {label ? (
          <span
            className="truncate text-sm font-bold"
            style={{ color: "#ffffff" }}
          >
            {label}
          </span>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              color: "#ffffff",
              backgroundColor: "rgba(255,255,255,0.2)",
            }}
          >
            {t(`error_type.${entry.errorType}`)}
          </span>
          {entry.reviewCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                color: "#ffffff",
                backgroundColor: "rgba(255,255,255,0.2)",
              }}
            >
              <RotateCw aria-hidden size={11} />
              {t("card_review_count", { count: entry.reviewCount })}
            </span>
          ) : null}
        </div>
        {entry.note ? (
          <span
            className="line-clamp-2 text-xs"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {entry.note}
          </span>
        ) : null}
      </div>

      {progress ? (
        <span
          className="absolute right-14 top-3 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ color: "#ffffff", backgroundColor: "rgba(17,17,17,0.6)" }}
        >
          {t("review_progress", {
            current: progress.current,
            total: progress.total,
          })}
        </span>
      ) : null}

      {/* Bottom bar: the same gradient-over-photo trick as the entry card's own hover overlay,
          just holding the review question and its buttons instead of a caption. */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col gap-2 rounded-b-[var(--radius-card)] p-3"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.5) 65%, transparent)",
        }}
      >
        <FormError message={error} />
        <p className="text-sm font-semibold" style={{ color: "#ffffff" }}>
          {t("review_question")}
        </p>
        <ReviewActions
          busy={busy}
          onSolved={onSolved}
          onMissed={onMissed}
          onLater={onLater}
          onDark
        />
      </div>
    </>
  );
}

/** No photo to overlay controls onto, so this stays a plain bounded block, like before. */
function TextOnlyReviewCard({
  entry,
  busy,
  error,
  progress,
  onSolved,
  onMissed,
  onLater,
}: ReviewCardProps) {
  const t = useTranslations("notebook");
  const label = entry.topicName ?? entry.subjectName;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <SectionHeading as="h2" subtitle={t("review_subtitle")}>
          {t("review_title")}
        </SectionHeading>
        {progress ? (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              color: "var(--color-chip-text)",
              backgroundColor: "var(--color-chip)",
            }}
          >
            {t("review_progress", {
              current: progress.current,
              total: progress.total,
            })}
          </span>
        ) : null}
      </div>

      <FormError message={error} />

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="self-start rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            color: "var(--color-chip-text)",
            backgroundColor: "var(--color-chip)",
          }}
        >
          {t(`error_type.${entry.errorType}`)}
        </span>
        {label ? (
          <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {label}
          </span>
        ) : null}
      </div>

      {entry.note ? (
        <p className="text-sm" style={{ color: "var(--color-body)" }}>
          {entry.note}
        </p>
      ) : null}

      <p
        className="text-sm font-semibold"
        style={{ color: "var(--color-main)" }}
      >
        {t("review_question")}
      </p>

      <ReviewActions
        busy={busy}
        onSolved={onSolved}
        onMissed={onMissed}
        onLater={onLater}
      />
    </div>
  );
}
