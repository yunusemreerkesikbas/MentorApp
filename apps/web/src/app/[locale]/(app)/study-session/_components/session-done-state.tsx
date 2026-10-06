"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { Share } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type {
  FocusGoalDto,
  QuestProgressView,
  StudyRoomTheme,
  StudySessionStatus,
  TodayPanelResponse,
} from "@mentor/types";
import { coachingControllerGetToday } from "@mentor/api-client";
import { Button, CompletionSummary } from "@mentor/ui";
import { useStreakCelebration } from "@/components/streak-celebration";
import { requestSessionReflection } from "@/lib/coach";
import { recoverSuggestedTask, sanitizeCoachDisplayText } from "@/lib/coach-reply-markers";
import { COMPLETION_STAR_TOTAL, sessionStarFill } from "@/lib/completion-stars";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { useSubscription } from "@/lib/subscription-context";
import { fetchQuests, isEconomyDisabled, notifyEconomyChanged } from "@/lib/economy";
import { useMentorToast } from "@/lib/mentor-toast";
import { scheduleSessionReturnReminder } from "@/lib/notification-api";
import { resolveSessionShare } from "@/lib/session-share";
import {
  SessionDoneMoodCheckin,
  SessionDoneSavedCheckin,
} from "./session-done-checkin";
import { buildSessionDoneStats } from "./session-done-stats";

const ConfettiBurst = dynamic(
  () => import("@/components/confetti-burst").then((module) => ({ default: module.ConfettiBurst })),
  { ssr: false },
);

/** The share window draws a canvas and loads a handwriting face: only when it is opened. */
const SessionShareSheet = dynamic(
  () => import("./session-share-sheet").then((module) => ({ default: module.SessionShareSheet })),
  { ssr: false },
);

/** Confetti meets the big centre star as it lands (`CompletionStars` reveal order). */
const CONFETTI_DELAY_MS = 550;
const CONFETTI_FALLBACK_MS = 6_500;

function unwrapTodayResponse(response: unknown): TodayPanelResponse {
  return ((response as { data?: TodayPanelResponse }).data ?? response) as TodayPanelResponse;
}

type StreakFeedback = "started" | "kept" | null;

function resolveStreakFeedback(
  baseline: number | null,
  currentStreak: number,
): StreakFeedback {
  if (baseline == null) return null;
  if (baseline === 0 && currentStreak >= 1) return "started";
  if (currentStreak > baseline) return "kept";
  return null;
}

const LINK_CLASS =
  "flex min-h-11 w-full cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

export interface SessionDoneStateProps {
  focusElapsed: number;
  /** Planned focus length in minutes (timer preset). */
  plannedMinutes: number;
  sessionId: string | null;
  subject?: string | null;
  planTaskTitle?: string | null;
  focusGoal?: FocusGoalDto | null;
  questBaseline?: QuestProgressView[] | null;
  streakBaseline?: number | null;
  countsAsFocusSession?: boolean;
  sessionStatus?: StudySessionStatus | null;
  planTaskAutoCompleted?: boolean;
  /** The room on screen when the session ended: the share card's photo and light. */
  theme: StudyRoomTheme;
  /** From the finished session; the share card's date and part of the day. */
  endedAt?: string | null;
  onSubmitFeedback: (mood: number, struggleNote?: string) => Promise<void>;
  onReset: () => void;
}

export function SessionDoneState({
  focusElapsed,
  plannedMinutes,
  sessionId,
  subject,
  planTaskTitle = null,
  focusGoal = null,
  questBaseline = null,
  streakBaseline = null,
  countsAsFocusSession = true,
  sessionStatus = null,
  planTaskAutoCompleted = false,
  theme,
  endedAt = null,
  onSubmitFeedback,
  onReset,
}: SessionDoneStateProps) {
  const reduceMotion = useReducedMotion();
  const locale = useLocale();
  const t = useTranslations("session");
  const toast = useMentorToast();
  const { tryCelebrate, celebration } = useStreakCelebration();
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [reflection, setReflection] = useState<string | null>(null);
  const [suggestedTask, setSuggestedTask] = useState<{
    title: string;
    subject: string | null;
  } | null>(null);
  const [reflecting, setReflecting] = useState(false);
  const [reflectionLocked, setReflectionLocked] = useState(false);
  const { openPaywall } = usePremiumPaywall();
  const {
    view: subscriptionView,
    refresh: refreshSubscription,
  } = useSubscription();
  const [remindStatus, setRemindStatus] = useState<"idle" | "saving" | "done">("idle");
  const [streakFeedback, setStreakFeedback] = useState<StreakFeedback>(null);
  const [currentStreak, setCurrentStreak] = useState<number | null>(null);
  const [streakReady, setStreakReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [questsResult, todayResult] = await Promise.all([
          fetchQuests().catch((err) => (isEconomyDisabled(err) ? null : Promise.reject(err))),
          coachingControllerGetToday(),
        ]);
        if (cancelled) return;

        const today = unwrapTodayResponse(todayResult);
        const streak = today.streak.currentStreak;
        setCurrentStreak(streak);
        setStreakFeedback(resolveStreakFeedback(streakBaseline, streak));
        if (countsAsFocusSession && streakBaseline != null) {
          tryCelebrate(streakBaseline, streak);
        }

        if (questsResult) notifyEconomyChanged();
      } catch {
        /* Economy disabled / network — stay silent (§4 tone). */
      } finally {
        if (!cancelled) setStreakReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only closure feedback; baselines are fixed when the done screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast is stable enough for one-shot announce
  }, [countsAsFocusSession, questBaseline, streakBaseline, tryCelebrate]);

  const tooShort = !countsAsFocusSession && sessionStatus !== "ABANDONED";
  const filled = sessionStarFill({
    elapsedSec: focusElapsed,
    plannedSec: plannedMinutes * 60,
    countsAsFocusSession,
    abandoned: sessionStatus === "ABANDONED",
  });
  const fullStars = filled >= COMPLETION_STAR_TOTAL;
  const [confetti, setConfetti] = useState<"waiting" | "playing" | "done">("waiting");

  useEffect(() => {
    if (!fullStars || reduceMotion) return;
    const start = window.setTimeout(() => setConfetti("playing"), CONFETTI_DELAY_MS);
    const fallback = window.setTimeout(() => setConfetti("done"), CONFETTI_FALLBACK_MS);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(fallback);
    };
  }, [fullStars, reduceMotion]);

  const filledLabel = filled.toLocaleString(locale, {
    minimumFractionDigits: filled % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });

  const stats = useMemo(
    () =>
      buildSessionDoneStats({
        t,
        focusElapsed,
        streakReady,
        currentStreak,
        focusGoal,
        subject: subject?.trim() ? subject.trim() : null,
        planTaskAutoCompleted,
        planTaskTitle,
      }),
    [
      t,
      focusElapsed,
      streakReady,
      currentStreak,
      focusGoal,
      subject,
      planTaskAutoCompleted,
      planTaskTitle,
    ],
  );

  const maybeReflect = async () => {
    if (!sessionId) return;
    setReflecting(true);
    try {
      // Shared read; only joins a request when the session ended before it settled.
      // A failed read leaves `view` null (not loading) — retry instead of treating it as free.
      const view = subscriptionView ?? (await refreshSubscription());
      if (!isPremiumFeatureAvailable(view, "session.reflection")) {
        setReflectionLocked(true);
        return;
      }
      const res = await requestSessionReflection(sessionId);
      if (res.reflection) {
        setReflection(sanitizeCoachDisplayText(res.reflection));
      }
      if (res.suggestedTask) {
        setSuggestedTask(res.suggestedTask);
      } else if (res.reflection) {
        const recovered = recoverSuggestedTask(res.reflection);
        if (recovered) setSuggestedTask(recovered);
      }
    } catch {
      /* Free / AI disabled / network — stay silent (§4 #5). */
    } finally {
      setReflecting(false);
    }
  };

  const handleSave = async () => {
    if (mood == null || status === "saving") return;
    setStatus("saving");
    try {
      await onSubmitFeedback(mood, note.trim() ? note.trim() : undefined);
      setStatus("saved");
      void maybeReflect();
    } catch {
      setStatus("idle");
    }
  };

  const shareParts = resolveSessionShare(focusElapsed, countsAsFocusSession);
  const [shareOpen, setShareOpen] = useState(false);
  // Fixed once: the card's date and part of the day must not move while the window is open.
  const [endedAtDate] = useState(() => (endedAt ? new Date(endedAt) : new Date()));

  const handleRemindTomorrow = async () => {
    if (remindStatus !== "idle") return;
    setRemindStatus("saving");
    try {
      const res = await scheduleSessionReturnReminder(subject);
      setRemindStatus("done");
      toast.success({
        title: res.alreadyScheduled
          ? t("return_remind_already_title")
          : t("return_remind_ok_title"),
        message: res.alreadyScheduled
          ? t("return_remind_already_message")
          : t("return_remind_ok_message"),
        duration: 3000,
      });
    } catch {
      setRemindStatus("idle");
      toast.error({
        title: t("return_remind_error_title"),
        message: t("return_remind_error_message"),
      });
    }
  };

  const statusLine = tooShort
    ? t("too_short_hint")
    : streakFeedback != null && currentStreak != null
      ? streakFeedback === "started"
        ? t("streak_started")
        : t("streak_kept", { days: currentStreak })
      : null;

  return (
    <>
      {celebration}
      {/* One celebration at a time (DESIGN.md §9.1): a streak milestone takes the stage. */}
      {confetti === "playing" && !celebration ? (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-10">
          <ConfettiBurst onComplete={() => setConfetti("done")} />
        </div>
      ) : null}
      <CompletionSummary
        title={t("done_title")}
        titleAs="h1"
        filled={filled}
        starsLabel={t("stars_label", { filled: filledLabel, total: COMPLETION_STAR_TOTAL })}
        stats={stats}
        status={
          statusLine ? (
            <p
              className="text-center text-sm"
              style={{ color: "var(--color-secondary)" }}
              role="status"
            >
              {statusLine}
            </p>
          ) : null
        }
      >
        <div className="flex w-full flex-col items-center gap-5">
          {status === "saved" ? (
            <SessionDoneSavedCheckin
              t={t}
              mood={mood}
              sessionId={sessionId}
              reflecting={reflecting}
              reflectionLocked={reflectionLocked}
              reflection={reflection}
              suggestedTask={suggestedTask}
              onOpenPaywall={() => openPaywall({ sourceFeature: "session.reflection" })}
            />
          ) : (
            <SessionDoneMoodCheckin
              t={t}
              reduceMotion={Boolean(reduceMotion)}
              mood={mood}
              note={note}
              subject={subject}
              saving={status === "saving"}
              onMood={setMood}
              onNote={setNote}
              onSave={() => void handleSave()}
            />
          )}

          <div className="flex w-full flex-col gap-3">
            <Button onClick={onReset} variant="primary" fullWidth>
              {t("new_session")}
            </Button>
            {shareParts ? (
              <Button variant="secondary" fullWidth onClick={() => setShareOpen(true)}>
                <Share size={20} strokeWidth={2.25} aria-hidden />
                {t("share_cta")}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleRemindTomorrow()}
              disabled={remindStatus !== "idle"}
              className={LINK_CLASS}
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {remindStatus === "done" ? t("return_remind_done") : t("return_remind_cta")}
            </button>
          </div>
        </div>
      </CompletionSummary>
      {shareOpen && shareParts ? (
        <SessionShareSheet
          minutes={shareParts.minutes}
          subject={subject?.trim() ? subject.trim() : null}
          stars={filled}
          theme={theme}
          endedAt={endedAtDate}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </>
  );
}
