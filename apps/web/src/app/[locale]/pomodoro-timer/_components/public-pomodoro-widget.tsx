"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { StudyRoomTheme } from "@mentor/types";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { SeoSignupCta } from "@/components/seo-lp/seo-signup-cta";
import type { AmbientTrackId } from "@/lib/ambient-tracks";
import { trackSeoLpEvent } from "@/lib/analytics";
import { recordSeoLpSource } from "@/lib/lp-attribution";
import { useSessionAmbientSound } from "../../(app)/study-session/_components/use-session-ambient-sound";
import type { FocusRoomTheme } from "../../_components/landing/focus-room";

export interface PublicPomodoroCopy {
  roomLabel: string;
  soundLabel: string;
  preset25: string;
  preset50: string;
  presetCustom: string;
  presetStopwatch: string;
  phaseFocus: string;
  phaseBreak: string;
  unitMin: string;
  unitElapsed: string;
  decreaseAria: string;
  increaseAria: string;
  plainView: string;
  start: string;
  pause: string;
  resume: string;
  finish: string;
  reset: string;
  doneTitle: string;
  doneBody: string;
  doneCta: string;
  doneAgain: string;
  sounds: Record<AmbientTrackId, string>;
}

type PresetMode = "25_5" | "50_10" | "custom" | "stopwatch";
type TimerState = "idle" | "focus" | "break" | "done";

const RING = 2 * Math.PI * 84;
const SOUND_IDS: readonly AmbientTrackId[] = ["scene", "library", "cafe", "home", "off"];

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function PublicPomodoroWidget({
  themes,
  copy,
}: {
  themes: FocusRoomTheme[];
  copy: PublicPomodoroCopy;
}) {
  const [room, setRoom] = useState<StudyRoomTheme>(themes[0]?.id ?? "LIBRARY");
  const [preset, setPreset] = useState<PresetMode>("25_5");
  const [focusMins, setFocusMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [state, setState] = useState<TimerState>("idle");
  const [paused, setPaused] = useState(false);
  const [plain, setPlain] = useState(false);
  const [seconds, setSeconds] = useState(25 * 60);

  const activeTheme = themes.find((item) => item.id === room) ?? themes[0]!;
  const soundPhase = state === "focus" ? "focus" : state === "break" ? "break" : "idle";
  const { trackId, setTrackId } = useSessionAmbientSound({
    phase: soundPhase,
    isPaused: paused,
    sceneTheme: room,
    suggestedTrackId: "scene",
  });

  useEffect(() => {
    recordSeoLpSource("pomodoro");
  }, []);

  useEffect(() => {
    if ((state !== "focus" && state !== "break") || paused) return;
    const id = window.setInterval(() => {
      setSeconds((prev) => {
        if (preset === "stopwatch") return prev + 1;
        if (prev > 1) return prev - 1;
        if (state === "focus" && breakMins > 0) {
          setState("break");
          return breakMins * 60;
        }
        setState("done");
        trackSeoLpEvent("pomodoro_complete", { preset, room });
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state, paused, preset, breakMins, room]);

  function selectPreset(next: PresetMode) {
    setPreset(next);
    setState("idle");
    setPaused(false);
    if (next === "25_5") {
      setFocusMins(25);
      setBreakMins(5);
      setSeconds(25 * 60);
    } else if (next === "50_10") {
      setFocusMins(50);
      setBreakMins(10);
      setSeconds(50 * 60);
    } else if (next === "stopwatch") {
      setBreakMins(0);
      setSeconds(0);
    } else {
      setBreakMins(5);
      setSeconds(focusMins * 60);
    }
  }

  function stepMinutes(delta: number) {
    const clamped = Math.min(120, Math.max(5, focusMins + delta));
    setPreset("custom");
    setFocusMins(clamped);
    setBreakMins(5);
    if (state === "idle") setSeconds(clamped * 60);
  }

  function startTimer() {
    setPaused(false);
    setState("focus");
    setSeconds(preset === "stopwatch" ? 0 : focusMins * 60);
    trackSeoLpEvent("pomodoro_start", { preset, room });
  }

  function finishTimer() {
    setPaused(false);
    setState("done");
    trackSeoLpEvent("pomodoro_complete", { preset, room });
  }

  function resetTimer() {
    setPaused(false);
    setState("idle");
    setSeconds(preset === "stopwatch" ? 0 : focusMins * 60);
  }

  const totalTarget =
    preset === "stopwatch"
      ? 3600
      : (state === "break" ? breakMins : focusMins) * 60;
  const ratio =
    preset === "stopwatch"
      ? Math.min(1, (seconds % 3600) / 3600)
      : state === "idle"
        ? focusMins / 120
        : Math.max(0, Math.min(1, seconds / Math.max(1, totalTarget)));
  const arc = ratio * RING;
  const knob = ratio * 2 * Math.PI;

  return (
    <div id="timer" className="lf-room scroll-mt-24" data-room={room}>
      <div className="lf-toolbar flex flex-wrap items-center justify-between gap-3">
        <div className="lf-tabs" role="group" aria-label={copy.roomLabel}>
          {themes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`lf-tab${item.id === room ? " is-on" : ""}`}
              aria-pressed={item.id === room}
              onClick={() => setRoom(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="lf-sounds flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={copy.soundLabel}>
            {SOUND_IDS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={trackId === id}
                onClick={() => setTrackId(id)}
                className={`min-h-9 rounded-full border px-3 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
                  trackId === id
                    ? "border-transparent bg-[var(--landing-ink)] text-[var(--landing-paper)]"
                    : "border-[var(--landing-paper-line)] bg-[var(--color-surface)] text-[var(--landing-ink)]"
                }`}
              >
                {id !== "off" && trackId === id ? "♪ " : ""}
                {copy.sounds[id]}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={plain}
            onClick={() => setPlain((v) => !v)}
            className={`min-h-9 rounded-full border px-3 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
              plain
                ? "border-transparent bg-[var(--landing-ink)] text-[var(--landing-paper)]"
                : "border-[var(--landing-paper-line)] bg-[var(--color-surface)] text-[var(--landing-ink)]"
            }`}
          >
            {copy.plainView}
          </button>
        </div>
      </div>

      <div className={`lf-scene${activeTheme.light && !plain ? " is-light" : ""}`}>
        {!plain &&
          themes.map((item) => (
            <Image
              key={item.id}
              src={item.backdrop}
              alt=""
              fill
              priority={item.id === "LIBRARY"}
              sizes="(min-width: 768px) 528px, 100vw"
              className={`lf-backdrop${item.id === room ? " is-on" : ""}`}
            />
          ))}
        <div className="lf-ui">
          <div className="lf-bar">
            <span>{ state === "break" ? copy.phaseBreak : copy.phaseFocus }</span>
            <i />
            <span>{activeTheme.label}</span>
            <i />
            <span>{trackId === "off" ? copy.sounds[trackId] : `♪ ${copy.sounds[trackId]}`}</span>
          </div>

          {state === "done" ? (
            <div className="lf-done mx-auto my-6 flex max-w-md flex-col items-center rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--landing-paper)] p-6 text-center text-[var(--landing-ink)] shadow-lg">
              <p className="text-xl font-black">{copy.doneTitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--landing-ink-soft)]">{copy.doneBody}</p>
              <div className="mt-5 flex w-full flex-col gap-2.5">
                <SeoSignupCta
                  source="pomodoro"
                  location="timer_done"
                  className={`${LEDGE} ${LEDGE_FILLED} w-full`}
                >
                  {copy.doneCta}
                </SeoSignupCta>
                <button
                  type="button"
                  onClick={resetTimer}
                  className="inline-flex min-h-11 items-center justify-center rounded-[var(--play-radius)] border-2 border-[var(--landing-paper-line)] px-4 text-sm font-extrabold text-[var(--landing-ink)]"
                >
                  {copy.doneAgain}
                </button>
              </div>
            </div>
          ) : (
            <>
              <svg className="lf-ring" viewBox="0 0 200 200" role="timer" aria-live="off">
                <circle cx="100" cy="100" r="84" fill="none" stroke="var(--lf-line)" strokeWidth="6" />
                <circle
                  cx="100"
                  cy="100"
                  r="84"
                  fill="none"
                  stroke="#55acee"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${arc} ${RING}`}
                  transform="rotate(-90 100 100)"
                />
                <circle
                  cx={100 + 84 * Math.sin(knob)}
                  cy={100 - 84 * Math.cos(knob)}
                  r="9"
                  fill="var(--lf-knob)"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <text x="100" y="108" textAnchor="middle" fontWeight="900" fontSize={state === "idle" && preset !== "stopwatch" ? "54" : "42"} fill="currentColor">
                  {state === "idle" && preset !== "stopwatch" ? focusMins : formatClock(seconds)}
                </text>
                <text x="100" y="132" textAnchor="middle" fontWeight="700" fontSize="12" fill="currentColor" opacity=".8">
                  {preset === "stopwatch" ? copy.unitElapsed : copy.unitMin}
                </text>
              </svg>

              {state === "idle" && preset !== "stopwatch" ? (
                <div className="lf-steps">
                  <button
                    type="button"
                    aria-label={copy.decreaseAria}
                    onClick={() => stepMinutes(-5)}
                    className="cursor-pointer select-none"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label={copy.increaseAria}
                    onClick={() => stepMinutes(5)}
                    className="cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              ) : null}

              <div className="lf-presets">
                {(
                  [
                    { id: "stopwatch", label: copy.presetStopwatch },
                    { id: "25_5", label: copy.preset25 },
                    { id: "50_10", label: copy.preset50 },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={preset === item.id}
                    onClick={() => selectPreset(item.id)}
                    className={`cursor-pointer ${preset === item.id ? "is-on" : ""}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5">
                {state === "idle" ? (
                  <button type="button" onClick={startTimer} className="lf-start cursor-pointer">
                    {copy.start}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setPaused((v) => !v)}
                      className="lf-start cursor-pointer"
                    >
                      {paused ? copy.resume : copy.pause}
                    </button>
                    <button
                      type="button"
                      onClick={finishTimer}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-current px-4 text-sm font-extrabold"
                    >
                      {copy.finish}
                    </button>
                    <button
                      type="button"
                      onClick={resetTimer}
                      className="inline-flex min-h-11 cursor-pointer items-center px-3 text-xs font-bold underline"
                    >
                      {copy.reset}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
