"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { TodayPanelResponse } from "@mentor/types";
import { ApiClientError, coachingControllerGetToday } from "@mentor/api-client";
import { CountdownCard, StreakBadge } from "@mentor/ui";
import { FormError } from "@/components/form";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import { CountdownPlaceholder } from "./countdown-placeholder";
import { MoodCheckin } from "./mood-checkin";
import { StartSessionCta } from "./start-session-cta";
import { TodayPlan } from "./today-plan";
import { VisionBoardCard } from "./vision-board-card";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TodayPanelResponse };

/**
 * Panel data loader — client fetch because the access token lives in memory
 * (AuthProvider); the httpOnly refresh cookie is scoped to `/v1/auth` only.
 */
export function PanelShell() {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("panel");
  const tCountdown = useTranslations("countdown");
  const tStreak = useTranslations("streak");
  const ui = useTranslations("common");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    coachingControllerGetToday()
      .then((res) => {
        if (!active) return;
        setState({
          status: "ready",
          data: res as unknown as TodayPanelResponse,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message:
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err),
        });
      });
    return () => {
      active = false;
    };
  }, []);

  function refreshAfterTaskChange() {
    if (state.status !== "ready") return;
    coachingControllerGetToday()
      .then((res) => {
        const data = res as unknown as TodayPanelResponse;
        setState((prev) =>
          prev.status === "ready"
            ? {
                status: "ready",
                data: {
                  ...prev.data,
                  tasks: data.tasks,
                  streak: data.streak,
                  motivationalLine: data.motivationalLine,
                },
              }
            : prev,
        );
      })
      .catch(() => {
        /* Keep optimistic task state; streak refresh is best-effort. */
      });
  }

  if (state.status === "loading") {
    return (
      <main
        className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10"
        aria-busy
        aria-label={t("loading")}
      >
        <div className="mb-6 flex flex-col gap-2 lg:mb-8">
          <SkeletonBar className="h-9 w-64" />
          <SkeletonBar className="h-5 w-80 max-w-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={1} />
          </div>
          <div className="flex flex-col gap-6">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
        <FormError message={state.message} />
      </main>
    );
  }

  const {
    greetingName,
    motivationalLine,
    countdown,
    streak,
    tasks,
    sessionPresets,
    mood,
  } = state.data;

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" as const },
        },
      };

  const gridMotion = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: staggerListVariants,
      };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <motion.header className="mb-6 lg:mb-8" {...headerMotion}>
        <h1
          className="text-3xl font-bold"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("greeting", { name: greetingName })}
        </h1>
        <p
          className="mt-1 text-base"
          style={{ color: "var(--color-secondary)" }}
        >
          {motivationalLine}
        </p>
      </motion.header>

      <motion.div
        className="grid gap-6 lg:grid-cols-3 lg:items-start"
        {...gridMotion}
      >
        {/* Action column (left on desktop, first on mobile — the daily ritual: plan → focus → mood). */}
        <motion.section
          className="flex flex-col gap-6 lg:col-span-2"
          variants={reduceMotion ? undefined : staggerItemVariants}
        >
          <TodayPlan tasks={tasks} onTasksChanged={refreshAfterTaskChange} />
          <StartSessionCta presets={sessionPresets} />
          <MoodCheckin initial={mood} />
        </motion.section>

        {/* Context rail (right on desktop, after the action column on mobile): when · momentum · why. */}
        <motion.aside
          className="flex flex-col gap-6"
          variants={reduceMotion ? undefined : staggerItemVariants}
        >
          {countdown ? (
            <CountdownCard
              daysRemaining={countdown.daysRemaining}
              examName={countdown.examName}
              examDateLabel={countdown.examDateLabel}
              source={{ label: countdown.source, url: countdown.sourceUrl }}
              labels={{
                remaining: tCountdown("title"),
                dayUnit: tCountdown("day_unit"),
                today: tCountdown("today"),
                sourcePrefix: ui("source_prefix"),
              }}
            />
          ) : (
            <CountdownPlaceholder />
          )}
          <StreakBadge
            title={
              streak.currentStreak > 0
                ? tStreak("active_title", { count: streak.currentStreak })
                : tStreak("start_title")
            }
            subline={
              streak.currentStreak > 0 ? tStreak("active_sub") : tStreak("start_sub")
            }
            freezeNote={
              (streak.freezeTokens ?? 0) > 0
                ? tStreak("freeze_note", { count: streak.freezeTokens })
                : undefined
            }
          />
          <VisionBoardCard />
        </motion.aside>
      </motion.div>
    </main>
  );
}

/* --- Loading skeletons (DESIGN.md tokens; product register: skeletons, not a centered spinner). --- */

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-[var(--radius-card)] bg-white/60 motion-reduce:animate-none ${className ?? ""}`}
    />
  );
}

function SkeletonCard({ lines }: { lines: number }) {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-white bg-white/50 p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <SkeletonBar className="h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBar key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}
