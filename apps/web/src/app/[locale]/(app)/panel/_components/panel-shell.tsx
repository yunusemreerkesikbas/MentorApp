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
      <main className="mx-auto flex min-h-[40vh] w-full max-w-6xl items-center justify-center px-5 py-8 lg:px-8">
        <p style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
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
        <motion.section
          className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-2"
          variants={reduceMotion ? undefined : staggerItemVariants}
        >
          <TodayPlan tasks={tasks} onTasksChanged={refreshAfterTaskChange} />
          <StartSessionCta presets={sessionPresets} />
          <MoodCheckin initial={mood} />
        </motion.section>

        <motion.aside
          className="order-1 flex flex-col gap-6 lg:order-2"
          variants={reduceMotion ? undefined : staggerItemVariants}
        >
          {countdown ? (
            <CountdownCard
              daysRemaining={countdown.daysRemaining}
              examName={countdown.examName}
              examDateLabel={countdown.examDateLabel}
              source={{ label: countdown.source, url: countdown.sourceUrl }}
            />
          ) : (
            <CountdownPlaceholder />
          )}
          <StreakBadge
            currentStreak={streak.currentStreak}
            freezeTokens={streak.freezeTokens}
          />
        </motion.aside>
      </motion.div>
    </main>
  );
}
