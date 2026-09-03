"use client";

import { Focus, Wallpaper } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { StudyRoomTheme } from "@mentor/types";
import type { AmbientTrackId } from "@/lib/ambient-tracks";
import { RoomThemeSwitcher } from "./room-theme-switcher";
import { SessionAmbientPicker } from "./session-ambient-picker";
import { SessionSubjectPicker } from "./session-subject-picker";

export function PlanTaskContextChip({ title }: { title: string }) {
  return (
    <span
      className="max-w-full truncate rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-progress) 14%, transparent)",
        color: "var(--color-main)",
        fontFamily: "var(--font-body)",
      }}
      title={title}
    >
      {title}
    </span>
  );
}

export interface SessionTopBarProps {
  activeTheme: StudyRoomTheme;
  subject: string | null;
  onSubjectChange: (subject: string | null) => void;
  readOnlySubject?: boolean;
  seatedRoom?: { id: string; name: string; isOwner: boolean } | null;
  themeBusy: boolean;
  isPlain: boolean;
  onThemeChange: (next: StudyRoomTheme, direction: 1 | -1) => void;
  onTogglePlain: () => void;
  ambientTrackId: AmbientTrackId;
  ambientMuted: boolean;
  onAmbientTrackChange: (id: AmbientTrackId) => void;
  onAmbientToggleMute: () => void;
}

/**
 * Top scenery and context controls: Subject picker, Room theme switcher (+ plain view toggle),
 * and Ambient sound picker. Aligned side-by-side in one responsive horizontal row.
 */
export function SessionTopBar({
  activeTheme,
  subject,
  onSubjectChange,
  readOnlySubject = false,
  seatedRoom,
  themeBusy,
  isPlain,
  onThemeChange,
  onTogglePlain,
  ambientTrackId,
  ambientMuted,
  onAmbientTrackChange,
  onAmbientToggleMute,
}: SessionTopBarProps) {
  const tRoom = useTranslations("session_room");

  return (
    <div
      className="room-stage flex w-full flex-col items-center gap-2"
      data-room-theme={activeTheme}
      style={
        {
          "--room-ink-soft": "#ffffff",
          "--room-accent": "var(--color-progress)",
          "--room-scrim": "rgba(255, 255, 255, 0.15)",
        } as CSSProperties
      }
    >
      {seatedRoom ? <PlanTaskContextChip title={seatedRoom.name} /> : null}
      <div className="flex max-w-full items-center justify-center gap-2 overflow-x-auto py-0.5 mentor-scrollarea flex-nowrap">
        <SessionSubjectPicker
          value={subject ?? ""}
          onChange={(v) => onSubjectChange(v.trim() ? v.trim() : null)}
          readOnly={readOnlySubject}
        />

        <div className="flex shrink-0 items-center gap-1 rounded-full py-0.5 pr-0.5 pl-1 session-liquid-pill">
          <RoomThemeSwitcher
            theme={activeTheme}
            canChange={seatedRoom ? seatedRoom.isOwner : true}
            busy={themeBusy}
            onChange={onThemeChange}
          />
          <button
            type="button"
            aria-pressed={isPlain}
            aria-label={tRoom(isPlain ? "plain_view_off" : "plain_view_on")}
            title={tRoom(isPlain ? "plain_view_off" : "plain_view_on")}
            onClick={onTogglePlain}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity duration-200 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--room-accent)] motion-reduce:transition-none"
            style={{ color: "var(--room-ink-soft)", opacity: 0.8 }}
          >
            {isPlain ? (
              <Wallpaper className="size-[18px]" strokeWidth={2} aria-hidden />
            ) : (
              <Focus className="size-[18px]" strokeWidth={2} aria-hidden />
            )}
          </button>
        </div>

        <SessionAmbientPicker
          trackId={ambientTrackId}
          muted={ambientMuted}
          onTrackIdChange={onAmbientTrackChange}
          onToggleMute={onAmbientToggleMute}
        />
      </div>
    </div>
  );
}
