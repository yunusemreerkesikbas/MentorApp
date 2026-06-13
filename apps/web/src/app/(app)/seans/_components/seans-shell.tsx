"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SessionPresetDto, StudySessionDto } from "@mentor/types";
import {
  ApiClientError,
  coachingControllerGetToday,
  studySessionControllerFinalize,
  studySessionControllerStart,
} from "@mentor/api-client";
import { Button, Card, Chip } from "@mentor/ui";
import { FormError } from "../../../../components/form";

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
  const [selectedPreset, setSelectedPreset] = useState<string>("25_5");
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [session, setSession] = useState<StudySessionDto | null>(null);
  const [focusElapsed, setFocusElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    if (presetParam === "25_5" || presetParam === "50_10") {
      setSelectedPreset(presetParam);
    }
  }, [presetParam]);

  const presetList = presets;

  const activePreset = presetList.find((p) => p.id === selectedPreset) ?? presetList[0]!;

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTick(), [clearTick]);

  async function startSession() {
    setError(null);
    setBusy(true);
    try {
      const started = (await studySessionControllerStart({
        preset: selectedPreset as "25_5" | "50_10",
      })) as unknown as StudySessionDto;
      setSession(started);
      setFocusElapsed(0);
      setSecondsLeft(presetSeconds(activePreset.focusMinutes));
      setPhase("focus");
      clearTick();
      tickRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearTick();
            setPhase("break");
            setSecondsLeft(presetSeconds(activePreset.breakMinutes));
            tickRef.current = setInterval(() => {
              setSecondsLeft((b) => (b <= 1 ? 0 : b - 1));
            }, 1000);
            return 0;
          }
          return s - 1;
        });
        setFocusElapsed((e) => e + 1);
      }, 1000);
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
    clearTick();
    setBusy(true);
    setError(null);
    try {
      await studySessionControllerFinalize(session.id, {
        status,
        actualFocusSeconds: focusElapsed,
      });
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
    clearTick();
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
