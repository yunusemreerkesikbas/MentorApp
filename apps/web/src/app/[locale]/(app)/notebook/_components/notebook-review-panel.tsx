"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
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
 * width column with the rest of the page still visible around it. `object-contain` inside a box
 * that's `h-[85vh]` and nothing narrower — no forced aspect ratio — the same reason
 * `NotebookImageLightbox` never had one: an exam page is almost always portrait, and a landscape
 * box around a portrait photo is what put the black bars either side of it.
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
      setIndex((current) => current + 1);
    } catch {
      setError(t("error_review"));
    } finally {
      setBusy(false);
    }
  }

  const bounded = stuck != null || !entry || !entry.url;

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
          className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <X aria-hidden size={18} />
        </button>

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
              <TextOnlyReviewCard
                entry={entry}
                busy={busy}
                error={error}
                progress={
                  entries.length > 1 ? { current: index + 1, total: entries.length } : null
                }
                onSolved={() => void answer(true)}
                onMissed={() => void answer(false)}
                onLater={onClose}
              />
            )}
          </div>
        ) : (
          <div
            // `object-contain` almost never fills this box exactly — a portrait exam photo leaves
            // the box wider than it is, a landscape one leaves it taller. Without a background of
            // its own the box was fully transparent there, so the overlaid info/buttons (positioned
            // against the BOX, not the photo inside it) looked like they'd come unstuck, floating
            // over the raw black backdrop rather than sitting on a photo card.
            className="relative h-[85vh] w-full max-w-3xl overflow-hidden rounded-[var(--radius-card)]"
            style={{ backgroundColor: "var(--color-bg)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <PhotoReviewCard
              entry={entry}
              busy={busy}
              error={error}
              progress={entries.length > 1 ? { current: index + 1, total: entries.length } : null}
              onSolved={() => void answer(true)}
              onMissed={() => void answer(false)}
              onLater={onClose}
            />
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
          className="flex min-h-9 items-center justify-center rounded-[var(--radius-card)] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
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
}: Pick<ReviewCardProps, "busy" | "onSolved" | "onMissed" | "onLater"> & { onDark?: boolean }) {
  const t = useTranslations("notebook");
  return (
    <div className="flex gap-2">
      <NotebookCompactButton busy={busy} onClick={onSolved}>
        {t("review_solved")}
      </NotebookCompactButton>
      <NotebookCompactButton variant="secondary" onDark={onDark} disabled={busy} onClick={onMissed}>
        {t("review_missed")}
      </NotebookCompactButton>
      <NotebookCompactButton variant="ghost" onDark={onDark} disabled={busy} onClick={onLater}>
        {t("review_later")}
      </NotebookCompactButton>
    </div>
  );
}

/** The full-preview shell: photo edge to edge, everything else floating on top of it. */
function PhotoReviewCard({ entry, busy, error, progress, onSolved, onMissed, onLater }: ReviewCardProps) {
  const t = useTranslations("notebook");
  const label = entry.topicName ?? entry.subjectName;

  return (
    <>
      <Image src={entry.url!} alt="" fill className="object-contain" unoptimized />

      {/* Same visual language as `NotebookEntryCard`'s own hover overlay — one way this information
          looks, wherever a mistake shows up. A thin tint is what keeps it readable over whatever
          part of the photo happens to sit behind it. */}
      <div
        className="absolute left-3 top-3 flex max-w-[70%] flex-col gap-1 rounded-[var(--radius-card)] px-2.5 py-2"
        style={{ background: "rgba(17,17,17,0.6)" }}
      >
        <span
          className="self-start rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ color: "#ffffff", backgroundColor: "rgba(255,255,255,0.2)" }}
        >
          {t(`error_type.${entry.errorType}`)}
        </span>
        {label ? (
          <span className="truncate text-xs font-bold" style={{ color: "#ffffff" }}>
            {label}
          </span>
        ) : null}
        {entry.note ? (
          <span className="line-clamp-2 text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>
            {entry.note}
          </span>
        ) : null}
      </div>

      {progress ? (
        <span
          className="absolute right-14 top-3 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ color: "#ffffff", backgroundColor: "rgba(17,17,17,0.6)" }}
        >
          {t("review_progress", { current: progress.current, total: progress.total })}
        </span>
      ) : null}

      {/* Bottom bar: the same gradient-over-photo trick as the entry card's own hover overlay,
          just holding the review question and its buttons instead of a caption. */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col gap-2 rounded-b-[var(--radius-card)] p-3"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.5) 65%, transparent)" }}
      >
        <FormError message={error} />
        <p className="text-sm font-semibold" style={{ color: "#ffffff" }}>
          {t("review_question")}
        </p>
        <ReviewActions busy={busy} onSolved={onSolved} onMissed={onMissed} onLater={onLater} onDark />
      </div>
    </>
  );
}

/** No photo to overlay controls onto, so this stays a plain bounded block, like before. */
function TextOnlyReviewCard({ entry, busy, error, progress, onSolved, onMissed, onLater }: ReviewCardProps) {
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
            style={{ color: "var(--color-chip-text)", backgroundColor: "var(--color-chip)" }}
          >
            {t("review_progress", { current: progress.current, total: progress.total })}
          </span>
        ) : null}
      </div>

      <FormError message={error} />

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="self-start rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ color: "var(--color-chip-text)", backgroundColor: "var(--color-chip)" }}
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

      <p className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
        {t("review_question")}
      </p>

      <ReviewActions busy={busy} onSolved={onSolved} onMissed={onMissed} onLater={onLater} />
    </div>
  );
}
