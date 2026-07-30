"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type {
  AuthUser,
  DeepAnalysisView,
  ExamCalendarDto,
  WeeklyReviewDto,
  WeeklyReviewNarrationDto,
} from "@mentor/types";
import {
  ApiClientError,
  contentControllerCalendarByFamily,
  usersControllerMe,
} from "@mentor/api-client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import CalendarPlus from "lucide-react/dist/esm/icons/calendar-plus.mjs";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import Lock from "lucide-react/dist/esm/icons/lock.mjs";
import Share2 from "lucide-react/dist/esm/icons/share-2.mjs";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { PuhuImage } from "@/components/puhu-image";
import { Link, useRouter } from "@/i18n/navigation";
import { trackWeeklyRecapEvent } from "@/lib/analytics";
import { narrateWeeklyReview } from "@/lib/coach";
import { fetchDeepAnalysis, purchaseDeepAnalysis } from "@/lib/economy";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  buildWeeklyRecapShareCardModel,
  buildWeeklyRecapShareText,
  composeWeeklyRecapSlides,
  markWeeklyRecapOpened,
  weeklyRecapExitHref,
  type WeeklyRecapSlide,
  type WeeklyRecapSource,
} from "@/lib/weekly-recap";
import { fetchWeeklyReview } from "@/lib/weekly-recap-api";
import { renderWeeklyRecapShareCard } from "@/lib/weekly-recap-share-card";
import { WeeklyRecapContentSkeleton } from "./weekly-recap-content-skeleton";
import {
  WeeklyRecapStory,
  type RecapTranslate,
} from "./weekly-recap-story";

type LoadState =
  | { status: "loading" }
  | { status: "needs_exam_type" }
  | { status: "error"; message: string }
  | { status: "ready"; examId: string; review: WeeklyReviewDto };

type AccessState =
  | { status: "idle" | "loading" | "unavailable" }
  | { status: "ready"; view: DeepAnalysisView };

export type NarrationState =
  | { status: "idle" | "loading" | "fallback" }
  | { status: "ready"; data: WeeklyReviewNarrationDto };

export function WeeklyRecapShell() {
  const t = useTranslations("analysis.recap");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useMentorToast();
  const reducedMotion = useReducedMotion() ?? false;
  const requestedExamId = searchParams.get("examId");
  const requestedExamType = searchParams.get("examType");
  const source: WeeklyRecapSource =
    searchParams.get("source") === "dashboard" ? "dashboard" : "analysis";
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [access, setAccess] = useState<AccessState>({ status: "idle" });
  const [narration, setNarration] = useState<NarrationState>({
    status: "idle",
  });
  const [noteOpen, setNoteOpen] = useState(false);
  const [unlockArmed, setUnlockArmed] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const openedTracked = useRef(false);
  const completedTracked = useRef(false);

  const loadNarration = useCallback(async (examId: string) => {
    setNarration({ status: "loading" });
    try {
      const data = await narrateWeeklyReview(examId);
      setNarration({ status: "ready", data });
    } catch {
      setNarration({ status: "fallback" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    openedTracked.current = false;
    completedTracked.current = false;

    async function load() {
      try {
        let examId = requestedExamId;
        if (!examId) {
          let examType = requestedExamType;
          if (!examType) {
            const user = (await usersControllerMe()) as unknown as AuthUser;
            examType = user.examType;
          }
          if (!examType) {
            if (!cancelled) setState({ status: "needs_exam_type" });
            return;
          }

          const calendar = (await contentControllerCalendarByFamily(
            examType,
          )) as unknown as ExamCalendarDto | null;
          examId = calendar?.exam?.id ?? null;
          if (!examId) {
            if (!cancelled) {
              setState({ status: "error", message: t("exam_unavailable") });
            }
            return;
          }
        }

        const review = await fetchWeeklyReview(examId);
        if (cancelled) return;
        setState({ status: "ready", examId, review });

        if (source === "dashboard") {
          markWeeklyRecapOpened(window.localStorage, review.period.startDate);
        }
        if (!openedTracked.current) {
          openedTracked.current = true;
          trackWeeklyRecapEvent("weekly_recap_open", {
            surface: source,
            recap_status: review.recap.status,
          });
        }

        if (review.recap.status !== "READY") return;
        setAccess({ status: "loading" });
        void fetchDeepAnalysis(examId)
          .then((view) => {
            if (cancelled) return;
            setAccess({ status: "ready", view });
            if (view.eligible && (view.premium || view.unlocked)) {
              void loadNarration(examId);
            }
          })
          .catch(() => {
            if (!cancelled) setAccess({ status: "unavailable" });
          });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            error instanceof ApiClientError
              ? error.message
              : error instanceof Error
                ? error.message
                : t("load_error"),
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    loadAttempt,
    loadNarration,
    requestedExamId,
    requestedExamType,
    source,
    t,
  ]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const review = state.status === "ready" ? state.review : null;
  const slides = useMemo(
    () => (review ? composeWeeklyRecapSlides(review) : []),
    [review],
  );
  const exit = useCallback(() => {
    router.push(weeklyRecapExitHref(source));
  }, [router, source]);

  const handleSlideView = useCallback(
    (slide: WeeklyRecapSlide) => {
      if (!review) return;
      trackWeeklyRecapEvent("weekly_recap_slide_view", {
        surface: "recap",
        recap_status: review.recap.status,
        slide_kind: slide.kind,
      });
    },
    [review],
  );

  const handleComplete = useCallback(() => {
    if (!review || completedTracked.current) return;
    completedTracked.current = true;
    trackWeeklyRecapEvent("weekly_recap_complete", {
      surface: "recap",
      recap_status: review.recap.status,
    });
  }, [review]);

  const handleShare = useCallback(async () => {
    if (!review || shareBusy) return;
    setShareBusy(true);
    const text = buildWeeklyRecapShareText(review, {
      title: t("share.title"),
      sessions: (count) => t("share.sessions", { count }),
      minutes: (count) => t("share.minutes", { count }),
      activeDays: (count) => t("share.active_days", { count }),
      completedTasks: (count) => t("share.tasks", { count }),
      weeklyTitle: (label) => t("share.weekly_title", { label }),
      topSubject: (name, minutes) =>
        t("share.top_subject", { name, minutes }),
    });
    try {
      const blob = await renderWeeklyRecapShareCard(
        buildWeeklyRecapShareCardModel(review),
        {
          title: t("share_card.title"),
          weeklyTitleLabel: t("share_card.weekly_title_label"),
          weeklyTitleFallback: t(
            "share_card.weekly_title_fallback",
          ),
          focus: t("share_card.focus"),
          activeDays: t("share_card.active_days"),
          sessions: t("share_card.sessions"),
          completedTasks: t("share_card.completed_tasks"),
          longestSession: t("share_card.longest_session"),
          longestRun: t("share_card.longest_run"),
          topSubject: t("share_card.top_subject"),
          minutes: (count) => t("share_card.minutes", { count }),
          days: (count) => t("share_card.days", { count }),
          count: (count) => t("share_card.count", { count }),
          subject: (name, minutes) =>
            t("share_card.subject", { name, minutes }),
          signature: t("share_card.signature"),
        },
      );
      const fileName = t("share.file_name");
      const file = new File([blob], fileName, { type: "image/png" });
      const fileShareData = { files: [file], title: t("share.title"), text };

      if (
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share(fileShareData);
      } else {
        downloadShareCard(blob, fileName);
        if (navigator.clipboard) {
          void navigator.clipboard.writeText(text).catch(() => undefined);
        }
        toast.success({ title: t("share.downloaded") });
      }
      trackWeeklyRecapEvent("weekly_recap_share", {
        surface: "recap",
        recap_status: review.recap.status,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error({ title: t("share.error") });
    } finally {
      setShareBusy(false);
    }
  }, [review, shareBusy, t, toast]);

  const handleUnlock = useCallback(async () => {
    if (state.status !== "ready" || access.status !== "ready") return;
    if (!unlockArmed) {
      setUnlockArmed(true);
      return;
    }

    setUnlockBusy(true);
    try {
      const view = await purchaseDeepAnalysis(state.examId);
      setAccess({ status: "ready", view });
      if (view.unlocked) {
        trackWeeklyRecapEvent("weekly_recap_ai_unlock", {
          surface: "recap",
          recap_status: state.review.recap.status,
        });
        void loadNarration(state.examId);
      }
    } catch {
      toast.error({ title: t("unlock.error") });
    } finally {
      setUnlockBusy(false);
      setUnlockArmed(false);
    }
  }, [access, loadNarration, state, t, toast, unlockArmed]);

  if (state.status === "loading") {
    return (
      <RecapViewport>
        <WeeklyRecapContentSkeleton />
      </RecapViewport>
    );
  }

  if (state.status === "needs_exam_type") {
    return (
      <RecapViewport>
        <RecapMessageState
          title={t("needs_exam.title")}
          message={t("needs_exam.message")}
          action={
            <Link className={primaryLinkClass} href="/profile">
              {t("needs_exam.cta")}
            </Link>
          }
          onExit={exit}
          exitLabel={t("exit")}
        />
      </RecapViewport>
    );
  }

  if (state.status === "error") {
    return (
      <RecapViewport>
        <RecapMessageState
          title={t("error.title")}
          message={state.message}
          action={
            <button
              type="button"
              onClick={() => {
                setState({ status: "loading" });
                setAccess({ status: "idle" });
                setNarration({ status: "idle" });
                setLoadAttempt((value) => value + 1);
              }}
              className={primaryLinkClass}
            >
              {t("error.retry")}
            </button>
          }
          onExit={exit}
          exitLabel={t("exit")}
        />
      </RecapViewport>
    );
  }

  if (state.review.recap.status === "EMPTY") {
    return (
      <RecapViewport>
        <RecapMessageState
          title={t("empty.title")}
          message={state.review.recap.closingMessage}
          action={
            <div className="flex w-full flex-col gap-3 sm:flex-row">
              <Link
                className={`${primaryLinkClass} flex-1`}
                href={{ pathname: "/plan", query: { add: "1" } }}
              >
                {t("empty.add_task")}
              </Link>
              <Link
                className={`${secondaryLinkClass} flex-1`}
                href="/study-session"
              >
                {t("empty.start_session")}
              </Link>
            </div>
          }
          onExit={exit}
          exitLabel={t("exit")}
        />
      </RecapViewport>
    );
  }

  const task = resolveSuggestedTask(state.review, narration);

  return (
    <>
      <WeeklyRecapStory
        slides={slides}
        review={state.review}
        locale={locale}
        reducedMotion={reducedMotion}
        t={t as unknown as RecapTranslate}
        finalDock={
          state.review.recap.status === "READY" ? (
            <FinalStoryDock
              review={state.review}
              task={task}
              shareBusy={shareBusy}
              onShare={() => void handleShare()}
              onOpenNote={() => setNoteOpen(true)}
              t={t as unknown as RecapTranslate}
            />
          ) : null
        }
        onExit={exit}
        onSlideView={handleSlideView}
        onComplete={handleComplete}
      />

      <AnimatePresence>
        {noteOpen ? (
          <PuhuNoteSheet
            review={state.review}
            narration={narration}
            access={access}
            unlockArmed={unlockArmed}
            unlockBusy={unlockBusy}
            onUnlock={() => void handleUnlock()}
            onClose={() => {
              setNoteOpen(false);
              setUnlockArmed(false);
            }}
            reducedMotion={reducedMotion}
            t={t as unknown as RecapTranslate}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function FinalStoryDock({
  review,
  task,
  shareBusy,
  onShare,
  onOpenNote,
  t,
}: {
  review: WeeklyReviewDto;
  task: { title: string; subject: string | null } | null;
  shareBusy: boolean;
  onShare: () => void;
  onOpenNote: () => void;
  t: RecapTranslate;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md items-center justify-center gap-1.5 rounded-full border border-white/30 bg-black/55 p-1.5 text-white shadow-2xl backdrop-blur-xl">
      {task ? (
        <Link
          href={{
            pathname: "/plan",
            query: {
              add: "1",
              title: task.title,
              ...(task.subject ? { subject: task.subject } : {}),
            },
          }}
          onClick={() =>
            trackWeeklyRecapEvent("weekly_recap_plan_click", {
              surface: "recap",
              recap_status: review.recap.status,
            })
          }
          className={dockActionClass}
        >
          <CalendarPlus className="size-5" aria-hidden />
          <span>{t("final.plan_short")}</span>
        </Link>
      ) : null}
      <button
        type="button"
        onClick={onShare}
        disabled={shareBusy}
        aria-busy={shareBusy || undefined}
        className={dockActionClass}
      >
        <Share2 className="size-5" aria-hidden />
        <span>
          {t(
            shareBusy
              ? "share.preparing_short"
              : "final.share_short",
          )}
        </span>
      </button>
      <button type="button" onClick={onOpenNote} className={dockActionClass}>
        <Sparkles className="size-5" aria-hidden />
        <span>{t("final.puhu_note")}</span>
      </button>
    </div>
  );
}

function PuhuNoteSheet({
  review,
  narration,
  access,
  unlockArmed,
  unlockBusy,
  onUnlock,
  onClose,
  reducedMotion,
  t,
}: {
  review: WeeklyReviewDto;
  narration: NarrationState;
  access: AccessState;
  unlockArmed: boolean;
  unlockBusy: boolean;
  onUnlock: () => void;
  onClose: () => void;
  reducedMotion: boolean;
  t: RecapTranslate;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const lockedView =
    access.status === "ready" &&
    access.view.eligible &&
    !access.view.premium &&
    !access.view.unlocked
      ? access.view
      : null;
  const hasAi = narration.status === "ready";

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 px-3 backdrop-blur-sm md:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <motion.section
        data-weekly-recap-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-recap-note-title"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 42 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
        transition={{ duration: reducedMotion ? 0 : 0.32 }}
        className="relative mb-3 w-full max-w-lg rounded-[var(--radius-card)] bg-white px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-7 text-center shadow-2xl md:mb-0"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("controls.close_note")}
          className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full bg-black/5 text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <X className="size-5" aria-hidden />
        </button>
        <PuhuImage
          variant={hasAi ? "premium" : "encouraging"}
          size={132}
          priority
          className="mx-auto drop-shadow-lg"
        />
        <h2
          id="weekly-recap-note-title"
          className="mt-4 text-3xl font-black tracking-[-0.04em] text-[var(--color-main)]"
        >
          {t(hasAi ? "puhu_sheet.ai_title" : "puhu_sheet.title")}
        </h2>
        <p className="mt-4 text-pretty text-base font-bold leading-7 text-[var(--color-secondary)]">
          {hasAi ? narration.data.narration : review.recap.closingMessage}
        </p>
        {narration.status === "loading" ? (
          <p className="mt-3 text-sm font-bold text-[var(--color-secondary)]">
            {t("puhu_sheet.loading")}
          </p>
        ) : null}

        {lockedView?.canAfford ? (
          <button
            type="button"
            aria-busy={unlockBusy || undefined}
            disabled={unlockBusy}
            onClick={onUnlock}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[var(--color-accent-soft)] px-5 py-3 text-sm font-bold text-[var(--color-main)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
          >
            {unlockArmed ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Lock className="size-4" aria-hidden />
            )}
            {unlockArmed
              ? t("unlock.confirm", { cost: lockedView.cost })
              : t("unlock.cta", { cost: lockedView.cost })}
          </button>
        ) : lockedView ? (
          <Link href="/profile" className={`${secondaryLinkClass} mt-6`}>
            {t("unlock.insufficient", {
              cost: lockedView.cost,
              balance: lockedView.coinConfirmed,
            })}
          </Link>
        ) : null}
      </motion.section>
    </motion.div>
  );
}

function resolveSuggestedTask(
  review: WeeklyReviewDto,
  narration: NarrationState,
): { title: string; subject: string | null } | null {
  const aiTask =
    narration.status === "ready" ? narration.data.suggestedTask : null;
  const deterministicTask = review.suggestedTask;
  const title = aiTask?.title ?? deterministicTask?.title ?? null;
  if (!title) return null;
  return {
    title,
    subject: aiTask?.subjectRef ?? deterministicTask?.subject ?? null,
  };
}

function downloadShareCard(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function RecapViewport({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] min-h-dvh overflow-y-auto bg-[var(--color-surface-container)]">
      <div className="relative">{children}</div>
    </div>
  );
}

function RecapMessageState({
  title,
  message,
  action,
  onExit,
  exitLabel,
}: {
  title: string;
  message: string;
  action: React.ReactNode;
  onExit: () => void;
  exitLabel: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <PuhuImage variant="encouraging" size="lg" priority />
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-main)]">
          {title}
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--color-secondary)]">
          {message}
        </p>
      </div>
      <div className="w-full">{action}</div>
      <button
        type="button"
        onClick={onExit}
        className="min-h-11 px-4 text-sm font-bold text-[var(--color-secondary)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        {exitLabel}
      </button>
    </main>
  );
}

const primaryLinkClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[var(--color-btn)] px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";
const secondaryLinkClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-white bg-white/70 px-5 py-3 text-sm font-bold text-[var(--color-main)] shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";
const dockActionClass =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-black text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
