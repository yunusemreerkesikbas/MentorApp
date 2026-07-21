"use client";

import type { ReactNode } from "react";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import Pause from "lucide-react/dist/esm/icons/pause.mjs";
import Play from "lucide-react/dist/esm/icons/play.mjs";
import SkipForward from "lucide-react/dist/esm/icons/skip-forward.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
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
      className={`flex cursor-pointer items-center justify-center rounded-full border border-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 motion-reduce:transition-none ${
        primary ? "h-16 w-16" : "h-12 w-12"
      }`}
      style={
        primary
          ? {
              backgroundColor: "var(--color-progress)",
              color: "#fff",
              boxShadow: "var(--shadow-card)",
            }
          : {
              backgroundColor: "var(--color-surface)",
              color: "var(--color-main)",
              boxShadow: "var(--shadow-card)",
            }
      }
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
      <Button onClick={onStart} busy={busy} fullWidth>
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
