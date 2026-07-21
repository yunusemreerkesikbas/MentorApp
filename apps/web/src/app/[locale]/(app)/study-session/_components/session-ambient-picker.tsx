"use client";

import { useTranslations } from "next-intl";
import {
  AMBIENT_TRACK_IDS,
  type AmbientTrackId,
  isAmbientTrackId,
} from "@/lib/ambient-tracks";

export interface SessionAmbientPickerProps {
  trackId: AmbientTrackId;
  onTrackIdChange: (trackId: AmbientTrackId) => void;
}

const TRACK_LABEL_KEYS: Record<AmbientTrackId, string> = {
  off: "track_off",
  soft: "track_soft",
  rain: "track_rain",
  warm: "track_warm",
};

export function SessionAmbientPicker({
  trackId,
  onTrackIdChange,
}: SessionAmbientPickerProps) {
  const translate = useTranslations("session_ambient");

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor="session-ambient-track"
        className="text-sm font-medium"
        style={{ color: "var(--color-body)", fontFamily: "var(--font-body)" }}
      >
        {translate("picker_label")}
      </label>
      <select
        id="session-ambient-track"
        value={trackId}
        onChange={(e) => {
          const value = e.target.value;
          if (isAmbientTrackId(value)) onTrackIdChange(value);
        }}
        className="w-full rounded-[var(--radius-card)] border px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2"
        style={{
          borderColor: "var(--color-progress-track)",
          backgroundColor: "var(--color-surface)",
          color: "var(--color-main)",
          fontFamily: "var(--font-body)",
        }}
      >
        {AMBIENT_TRACK_IDS.map((id) => (
          <option key={id} value={id}>
            {translate(TRACK_LABEL_KEYS[id])}
          </option>
        ))}
      </select>

      {trackId !== "off" ? (
        <p
          className="text-xs"
          style={{ color: "var(--color-secondary)", fontFamily: "var(--font-body)" }}
        >
          {translate("preview_hint")}
        </p>
      ) : null}
    </div>
  );
}
