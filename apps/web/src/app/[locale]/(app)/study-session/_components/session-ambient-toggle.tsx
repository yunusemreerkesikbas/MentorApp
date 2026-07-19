"use client";

import Volume2 from "lucide-react/dist/esm/icons/volume-2.mjs";
import VolumeX from "lucide-react/dist/esm/icons/volume-x.mjs";
import { useTranslations } from "next-intl";

export interface SessionAmbientToggleProps {
  muted: boolean;
  onToggleMute: () => void;
}

/** Session-only mute control — track is chosen on idle setup. */
export function SessionAmbientToggle({
  muted,
  onToggleMute,
}: SessionAmbientToggleProps) {
  const translate = useTranslations("session_ambient");

  return (
    <button
      type="button"
      onClick={onToggleMute}
      aria-label={muted ? translate("unmute") : translate("mute")}
      aria-pressed={!muted}
      title={muted ? translate("unmute") : translate("mute")}
      className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      style={{
        backgroundColor: muted
          ? "var(--color-surface)"
          : "color-mix(in srgb, var(--color-progress) 18%, var(--color-surface))",
        color: muted ? "var(--color-secondary)" : "var(--color-progress)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {muted ? (
        <VolumeX className="h-5 w-5" aria-hidden />
      ) : (
        <Volume2 className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
