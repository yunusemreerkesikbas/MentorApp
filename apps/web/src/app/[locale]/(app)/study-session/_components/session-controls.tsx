"use client";
import { Check, Pause, Play, SkipForward, X } from "lucide-react";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";

export interface SessionControlsProps {
  phase: "idle" | "focus" | "break" | "done";
  busy: boolean;
  isPaused: boolean;
  onStart: () => void;
  onTogglePause: () => void;
  onComplete: () => void;
  onAbandon: () => void;
  onSkipBreak: () => void;
}

function IconButton({
  label,
  onClick,
  busy,
  primary,
  children,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={`flex cursor-pointer items-center justify-center rounded-full session-liquid-pill transition-all duration-150 hover:scale-105 active:scale-95 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-40 motion-reduce:transition-none motion-reduce:hover:scale-100 ${
        primary ? "h-16 w-16" : "h-12 w-12"
      }`}
      style={{ color: "var(--color-main)" }}
    >
      {children}
    </button>
  );
}

export function SessionControls({
  phase,
  busy,
  isPaused,
  onStart,
  onTogglePause,
  onComplete,
  onAbandon,
  onSkipBreak,
}: SessionControlsProps) {
  const translate = useTranslations("session_controls");

  if (phase === "idle") {
    return (
      <Button
        onClick={onStart}
        busy={busy}
        fullWidth
        className="!rounded-full py-3.5 text-base font-bold transition-all duration-150 hover:scale-[1.01] active:scale-[0.98]"
        style={{
          fontFamily: "var(--font-heading)",
        }}
      >
        {translate("start")}
      </Button>
    );
  }

  const pauseButton = (
    <IconButton
      label={isPaused ? translate("resume") : translate("pause")}
      onClick={onTogglePause}
      primary
    >
      {isPaused ? (
        <Play size={26} aria-hidden />
      ) : (
        <Pause size={26} aria-hidden />
      )}
    </IconButton>
  );

  if (phase === "break") {
    return (
      <div className="flex items-center justify-center gap-6">
        {pauseButton}
        <IconButton label={translate("skip_break")} onClick={onSkipBreak} busy={busy}>
          <SkipForward size={22} aria-hidden />
        </IconButton>
      </div>
    );
  }

  if (phase !== "focus") return null;

  return (
    <div className="flex items-center justify-center gap-6">
      <IconButton label={translate("abandon")} onClick={onAbandon} busy={busy}>
        <X size={22} aria-hidden />
      </IconButton>
      {pauseButton}
      <IconButton label={translate("finish")} onClick={onComplete} busy={busy}>
        <Check size={22} aria-hidden />
      </IconButton>
    </div>
  );
}
