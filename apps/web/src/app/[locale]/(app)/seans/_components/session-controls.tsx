"use client";

import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";

export interface SessionControlsProps {
  phase: "idle" | "focus" | "done";
  busy: boolean;
  isPaused: boolean;
  isTimerComplete: boolean;
  onStart: () => void;
  onTogglePause: () => void;
  onComplete: () => void;
  onAbandon: () => void;
}

export function SessionControls({
  phase,
  busy,
  isPaused,
  isTimerComplete,
  onStart,
  onTogglePause,
  onComplete,
  onAbandon,
}: SessionControlsProps) {
  const translate = useTranslations("session_controls");
  if (phase === "idle") {
    return (
      <Button onClick={onStart} busy={busy} fullWidth>
        {translate("start")}
      </Button>
    );
  }

  if (phase !== "focus") return null;

  return (
    <div className="flex w-full flex-col gap-3">
      {isTimerComplete && (
        <p className="text-center text-sm font-semibold" style={{ color: "var(--color-secondary)" }}>
          {translate("time_up")}
        </p>
      )}
      <Button
        onClick={onTogglePause}
        busy={false}
        fullWidth
        className="!bg-white/60 !text-[var(--color-main)]"
      >
        {isPaused ? translate("resume") : translate("pause")}
      </Button>
      <Button onClick={onComplete} busy={busy} fullWidth>
        {translate("finish")}
      </Button>
      <Button
        onClick={onAbandon}
        busy={busy}
        fullWidth
        className="!bg-white/60 !text-[var(--color-main)]"
      >
        {translate("abandon")}
      </Button>
    </div>
  );
}
