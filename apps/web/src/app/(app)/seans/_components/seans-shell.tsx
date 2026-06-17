"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import type { SessionPresetDto, StudySessionDto } from "@mentor/types";
import { ApiClientError, coachingControllerGetToday } from "@mentor/api-client";
import { Button, Card, Chip, SectionHeading } from "@mentor/ui";
import { FormError } from "../../../../components/form";
import { finalizeStudySession, startStudySession } from "../../../../lib/study-sessions";

type Phase = "idle" | "focus" | "break" | "done";

const DEFAULT_PRESETS: SessionPresetDto[] = [
  { id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 },
  { id: "50_10", label: "50 / 10 dk", focusMinutes: 50, breakMinutes: 10 },
];

function presetSeconds(minutes: number): number {
  return minutes * 60;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Pomodoro session UI — start via API, timer runs client-side, finalize on complete/abandon.
 */
export function SeansShell() {
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const presetParam = searchParams.get("preset");

  const [presets, setPresets] = useState<SessionPresetDto[]>(DEFAULT_PRESETS);
  const [presetNotice, setPresetNotice] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>(
    presetParam === "50_10" ? "50_10" : "25_5",
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [session, setSession] = useState<StudySessionDto | null>(null);
  const [focusElapsed, setFocusElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          err instanceof ApiClientError
            ? err.message
            : "Oturum süreleri sunucudan alınamadı; varsayılan Pomodoro süreleri kullanılıyor.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  const presetList = presets;

  const activePreset = presetList.find((p) => p.id === selectedPreset) ?? presetList[0]!;

  const phaseEndsAtRef = useRef(0);

  const beginPhase = (next: "focus" | "break", seconds: number) => {
    phaseEndsAtRef.current = Date.now() + seconds * 1000;
    setSecondsLeft(seconds);
    setPhase(next);
  };

  useEffect(() => {
    if (phase !== "focus" && phase !== "break") return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((phaseEndsAtRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (phase === "focus") setFocusElapsed((e) => e + 1);
      if (remaining <= 0 && phase === "focus") {
        beginPhase("break", presetSeconds(activePreset.breakMinutes));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, activePreset]);

  async function startSession() {
    setError(null);
    setBusy(true);
    try {
      const started: StudySessionDto = await startStudySession({
        preset: selectedPreset as "25_5" | "50_10",
      });
      setSession(started);
      setFocusElapsed(0);
      beginPhase("focus", presetSeconds(activePreset.focusMinutes));
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Bir hata oluştu.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function finalize(status: "COMPLETED" | "ABANDONED") {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await finalizeStudySession(session.id, { status, actualFocusSeconds: focusElapsed });
      setPhase("done");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Bir hata oluştu.",
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhase("idle");
    setSession(null);
    setFocusElapsed(0);
    setSecondsLeft(0);
  }

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
      };

  const phaseMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
        exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
      };

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-8 lg:px-8 lg:py-10">
      <motion.header {...headerMotion}>
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Çalışma Seansı
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          Odaklan, molanı al, serini koru.
        </p>
      </motion.header>

      <FormError message={error} />
      {presetNotice && (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }} role="status">
          {presetNotice}
        </p>
      )}

      <Card className="flex flex-col items-center gap-6 py-10">
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              className="flex w-full flex-col items-center gap-6"
              {...phaseMotion}
            >
              <SectionHeading subtitle="Odak ve mola süresini seç">Süre</SectionHeading>
              <div className="flex flex-wrap justify-center gap-2">
                {presetList.map((p) => (
                  <motion.button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPreset(p.id)}
                    className="focus-visible:outline-none focus-visible:ring-2"
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  >
                    <Chip
                      className={
                        selectedPreset === p.id ? "ring-2 ring-[var(--color-main)] ring-offset-1" : ""
                      }
                    >
                      {p.label}
                    </Chip>
                  </motion.button>
                ))}
              </div>
              <Button onClick={() => void startSession()} busy={busy} fullWidth>
                Başla
              </Button>
            </motion.div>
          )}

          {(phase === "focus" || phase === "break") && (
            <motion.div
              key={phase}
              className="flex w-full flex-col items-center gap-6"
              {...phaseMotion}
            >
              <p
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-secondary)", fontFamily: "var(--font-heading)" }}
              >
                {phase === "focus" ? "Odaklan" : "Mola"}
              </p>
              <motion.p
                className="text-6xl font-bold tabular-nums"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                aria-live="polite"
                initial={reduceMotion ? false : { scale: 0.92, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {formatTime(secondsLeft)}
              </motion.p>
              <div className="flex w-full flex-col gap-3">
                {phase === "focus" && (
                  <Button onClick={() => void finalize("COMPLETED")} busy={busy} fullWidth>
                    Seansı bitir
                  </Button>
                )}
                <Button
                  onClick={() => void finalize("ABANDONED")}
                  busy={busy}
                  fullWidth
                  className="!bg-white/60 !text-[var(--color-main)]"
                >
                  Erken bırak
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div
              key="done"
              className="flex w-full flex-col items-center gap-6 text-center"
              {...phaseMotion}
            >
              <span
                className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
                  color: "var(--color-chip-text)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Seans kaydedildi
              </span>
              <p
                className="text-xl font-bold"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                Güzel iş çıkardın
              </p>
              <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                {Math.floor(focusElapsed / 60)} dakika odaklandın.
              </p>
              <div className="flex w-full flex-col gap-3">
                <Button onClick={reset} fullWidth>
                  Yeni seans
                </Button>
                <Link
                  href="/panel"
                  className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
                  style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                >
                  Panele dön
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Link
        href="/plan"
        className="flex min-h-[44px] items-center justify-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        ← Plana dön
      </Link>
    </main>
  );
}
