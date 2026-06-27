"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SessionPresetDto } from "@mentor/types";
import { ApiClientError, coachingControllerGetToday } from "@mentor/api-client";
import { Card, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { SessionControls } from "./session-controls";
import { SessionDoneState } from "./session-done-state";
import { SessionTimerRing } from "./session-timer-ring";
import { useSessionTimer } from "./use-session-timer";

const DEFAULT_PRESETS: SessionPresetDto[] = [
  { id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 },
  { id: "50_10", label: "50 / 10 dk", focusMinutes: 50, breakMinutes: 10 },
];

function parseInitialMinutes(
  presetParam: string | null,
  minutesParam: string | null,
): number {
  if (minutesParam) {
    const n = Number.parseInt(minutesParam, 10);
    if (!Number.isNaN(n) && n >= 5 && n <= 120 && n % 5 === 0) return n;
  }
  if (presetParam === "50_10") return 50;
  return 25;
}

function parseInitialPreset(
  presetParam: string | null,
  minutesParam: string | null,
): "25_5" | "50_10" | "custom" {
  if (minutesParam) {
    const n = Number.parseInt(minutesParam, 10);
    if (!Number.isNaN(n) && n >= 5 && n <= 120 && n % 5 === 0) return "custom";
  }
  if (presetParam === "50_10") return "50_10";
  return "25_5";
}

function parseInitialSelectedPresetId(
  presetParam: string | null,
  minutesParam: string | null,
): string | null {
  if (minutesParam) {
    const n = Number.parseInt(minutesParam, 10);
    if (!Number.isNaN(n) && n >= 5 && n <= 120 && n % 5 === 0) return null;
  }
  if (presetParam === "50_10") return "50_10";
  return "25_5";
}

/**
 * Pomodoro session UI — circular dial, pause/resume, API start/finalize.
 */
export function SeansShell() {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("session");
  const searchParams = useSearchParams();
  const presetParam = searchParams.get("preset");
  const minutesParam = searchParams.get("minutes");

  const [presets, setPresets] = useState<SessionPresetDto[]>(DEFAULT_PRESETS);
  const [presetNotice, setPresetNotice] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(() =>
    parseInitialSelectedPresetId(presetParam, minutesParam),
  );

  const timer = useSessionTimer({
    initialMinutes: parseInitialMinutes(presetParam, minutesParam),
    initialPreset: parseInitialPreset(presetParam, minutesParam),
  });

  useEffect(() => {
    let active = true;
    coachingControllerGetToday()
      .then((res) => {
        if (!active) return;
        const data = res as { sessionPresets?: SessionPresetDto[] };
        if (data.sessionPresets?.length) {
          setPresets(data.sessionPresets);
          setPresetNotice(null);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setPresets(DEFAULT_PRESETS);
        setPresetNotice(
          err instanceof ApiClientError ? err.message : t("preset_fallback"),
        );
      });
    return () => {
      active = false;
    };
  }, [t]);

  const {
    phase,
    focusMinutes,
    secondsLeft,
    focusElapsed,
    isPaused,
    isTimerComplete,
    busy,
    setFocusMinutes,
    selectPreset,
    startSession,
    togglePause,
    finalize,
    reset,
  } = timer;

  const handleMinutesChange = (minutes: number) => {
    setFocusMinutes(minutes);
    setSelectedPresetId(null);
  };

  const handlePresetSelect = (presetId: "25_5" | "50_10", minutes: number) => {
    selectPreset(presetId, minutes);
    setSelectedPresetId(presetId);
  };

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

  const phaseMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.25, ease: "easeOut" as const },
        },
        exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
      };

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-8 lg:px-8 lg:py-10">
      <motion.header {...headerMotion}>
        <h1
          className="text-3xl font-bold"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("title")}
        </h1>
        <p
          className="mt-1 text-base"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("subtitle")}
        </p>
      </motion.header>

      {presetNotice && (
        <p
          className="text-sm"
          style={{ color: "var(--color-secondary)" }}
          role="status"
        >
          {presetNotice}
        </p>
      )}

      <Card className="flex flex-col items-center gap-6 py-10">
        <AnimatePresence mode="wait">
          {phase !== "done" && (
            <motion.div
              key={phase === "focus" ? "focus" : "idle"}
              className="flex w-full flex-col items-center gap-6"
              {...phaseMotion}
            >
              {phase === "idle" && (
                <SectionHeading subtitle={t("duration_subtitle")}>
                  {t("duration_title")}
                </SectionHeading>
              )}
              {phase === "focus" && (
                <p
                  className="text-sm font-semibold uppercase tracking-wide"
                  style={{
                    color: "var(--color-secondary)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {isPaused ? t("paused") : t("focusing")}
                </p>
              )}
              <SessionTimerRing
                phase={phase}
                focusMinutes={focusMinutes}
                secondsLeft={secondsLeft}
                presets={presets}
                selectedPresetId={selectedPresetId}
                onMinutesChange={handleMinutesChange}
                onPresetSelect={handlePresetSelect}
              />
              <SessionControls
                phase={phase}
                busy={busy}
                isPaused={isPaused}
                isTimerComplete={isTimerComplete}
                onStart={() => void startSession()}
                onTogglePause={togglePause}
                onComplete={() => void finalize("COMPLETED")}
                onAbandon={() => void finalize("ABANDONED")}
              />
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div key="done" className="w-full" {...phaseMotion}>
              <SessionDoneState focusElapsed={focusElapsed} onReset={reset} />
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Link
        href="/plan"
        className="flex min-h-[44px] items-center justify-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {t("back_plan")}
      </Link>
    </main>
  );
}
