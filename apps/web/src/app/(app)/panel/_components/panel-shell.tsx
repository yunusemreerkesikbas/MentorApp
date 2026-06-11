"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SessionPresetDto, TodayPanelResponse } from "@mentor/types";
import { ApiClientError, coachingControllerGetToday } from "@mentor/api-client";
import { Card, CountdownCard, StreakBadge } from "@mentor/ui";
import { FormError } from "../../../../components/form";
import { TodayPlan } from "./today-plan";
import { MoodCheckin } from "./mood-checkin";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TodayPanelResponse };

/**
 * Panel data loader — client fetch because the access token lives in memory
 * (AuthProvider); the httpOnly refresh cookie is scoped to `/v1/auth` only.
 * App layout already gates on `status === "authenticated"`, so the bearer is set
 * when this mounts. Matches the abonelik page pattern.
 */
export function PanelShell() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const loadToday = useCallback(() => {
    return coachingControllerGetToday()
      .then((res) => setState({ status: "ready", data: res as unknown as TodayPanelResponse }))
      .catch((err: unknown) =>
        setState({
          status: "error",
          message:
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Bir hata oluştu.",
        }),
      );
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const refreshAfterTaskChange = useCallback(() => {
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
  }, [state.status]);

  if (state.status === "loading") {
    return (
      <main className="mx-auto flex min-h-[40vh] w-full max-w-6xl items-center justify-center px-5 py-8 lg:px-8">
        <p style={{ color: "var(--color-secondary)" }}>Yükleniyor…</p>
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

  const { greetingName, motivationalLine, countdown, streak, tasks, sessionPresets, mood } =
    state.data;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <header className="mb-6 lg:mb-8">
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Merhaba, {greetingName}
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          {motivationalLine}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <section className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-2">
          <TodayPlan tasks={tasks} onTasksChanged={refreshAfterTaskChange} />
          <StartSessionCta presets={sessionPresets} />
          <MoodCheckin initial={mood} />
        </section>

        <aside className="order-1 flex flex-col gap-6 lg:order-2">
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
          <StreakBadge currentStreak={streak.currentStreak} freezeTokens={streak.freezeTokens} />
        </aside>
      </div>
    </main>
  );
}

function CountdownPlaceholder() {
  return (
    <Card>
      <p
        className="text-base font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        Sınava kalan
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
        Sınav tarihi henüz ayarlanmadı. Profilden sınav türünü seçtiğinde geri sayım burada
        görünecek.
      </p>
    </Card>
  );
}

function StartSessionCta({ presets }: { presets: SessionPresetDto[] }) {
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <p
            className="text-base font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            Odaklanma zamanı
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
            Kısa, net bir Pomodoro seansıyla başla.
          </p>
        </div>

        <Link
          href="/seans"
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{
            backgroundColor: "var(--color-btn)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
          Çalışmaya başla
        </Link>

        <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
          Süre: {presets.map((p) => p.label).join(" · ")}
        </p>
      </div>
    </Card>
  );
}
