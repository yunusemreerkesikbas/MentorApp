"use client";

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
  if (phase === "idle") {
    return (
      <Button onClick={onStart} busy={busy} fullWidth>
        Başla
      </Button>
    );
  }

  if (phase !== "focus") return null;

  return (
    <div className="flex w-full flex-col gap-3">
      {isTimerComplete && (
        <p className="text-center text-sm font-semibold" style={{ color: "var(--color-secondary)" }}>
          Süre doldu — seansı kaydetmek için bitir.
        </p>
      )}
      <Button
        onClick={onTogglePause}
        busy={false}
        fullWidth
        className="!bg-white/60 !text-[var(--color-main)]"
      >
        {isPaused ? "Devam et" : "Duraklat"}
      </Button>
      <Button onClick={onComplete} busy={busy} fullWidth>
        Seansı bitir
      </Button>
      <Button
        onClick={onAbandon}
        busy={busy}
        fullWidth
        className="!bg-white/60 !text-[var(--color-main)]"
      >
        Erken bırak
      </Button>
    </div>
  );
}
