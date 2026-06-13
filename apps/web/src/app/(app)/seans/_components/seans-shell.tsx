"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SessionPresetDto, StudySessionDto } from "@mentor/types";
import { ApiClientError, coachingControllerGetToday } from "@mentor/api-client";
import { Button, Card, Chip } from "@mentor/ui";
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
    coachingControllerGetToday()
      .then((res) => {
        const data = res as { sessionPresets?: SessionPresetDto[] };
        if (data.sessionPresets?.length) {
          setPresets(data.sessionPresets);
          setPresetNotice(null);
        }
      })
      .catch((err: unknown) => {
        setPresets(DEFAULT_PRESETS);
        setPresetNotice(
          err instanceof ApiClientError
            ? err.message
            : "Oturum süreleri sunucudan alınamadı; varsayılan Pomodoro süreleri kullanılıyor.",
        );
      });
  }, []);

  const presetList = presets;

  const activePreset = presetList.find((p) => p.id === selectedPreset) ?? presetList[0]!;

  // Absolute end-of-phase timestamp; the interval derives the countdown from it (drift-free) and
  // owns the focus→break transition. Using a ref keeps the transition out of an effect body, and
  // the per-phase effect's cleanup tears the timer down so a re-mount can never leak an interval.
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
        // Roll into the break from inside the timer callback (not the effect body).
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
      // Leaving the focus/break phase stops the ticking effect.
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

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-8 lg:px-8 lg:py-10">
      <header>
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Çalışma Seansı
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          Odaklan, molanı al, serini koru.
        </p>
      </header>

      <FormError message={error} />
      {presetNotice && (
        <p className="mb-4 text-sm" style={{ color: "var(--color-secondary)" }} role="status">
          {presetNotice}
        </p>
      )}

      <Card className="flex flex-col items-center gap-6 py-10">
        {phase === "idle" && (
          <>
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              Süre seç
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {presetList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPreset(p.id)}
                  className="focus-visible:outline-none focus-visible:ring-2"
                >
                  <Chip
                    className={
                      selectedPreset === p.id ? "ring-2 ring-[var(--color-main)] ring-offset-1" : ""
                    }
                  >
                    {p.label}
                  </Chip>
                </button>
              ))}
            </div>
            <Button onClick={() => void startSession()} busy={busy} fullWidth>
              Başla
            </Button>
          </>
        )}

        {(phase === "focus" || phase === "break") && (
          <>
            <p
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-secondary)", fontFamily: "var(--font-heading)" }}
            >
              {phase === "focus" ? "Odaklan" : "Mola"}
            </p>
            <p
              className="text-6xl font-bold tabular-nums"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              aria-live="polite"
            >
              {formatTime(secondsLeft)}
            </p>
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
          </>
        )}

        {phase === "done" && (
          <>
            <p
              className="text-xl font-bold"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              Tebrikler, seans kaydedildi!
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
                className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                Panele dön
              </Link>
            </div>
          </>
        )}
      </Card>

      <Link
        href="/plan"
        className="text-center text-sm font-semibold transition-colors hover:opacity-80"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        ← Plana dön
      </Link>
    </main>
  );
}
