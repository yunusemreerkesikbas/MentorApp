"use client";

import { ChevronDown, Focus, Wallpaper } from "lucide-react";
import { useTranslations } from "next-intl";
import type { StudyRoomTheme } from "@mentor/types";
import type { AmbientTrackId } from "@/lib/ambient-tracks";
import { STUDY_ROOM_THEME_IDS } from "@/lib/study-room-theme";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { RoomThemeSwitcher } from "./room-theme-switcher";
import { SessionAmbientPicker } from "./session-ambient-picker";
import {
  SESSION_CHROME_PILL_CLASS,
  SESSION_CHROME_PILL_STYLE,
} from "./session-chrome-pill";
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
 * Top scenery and context controls: subject, scene, sound, as segments of one glass strip.
 *
 * From `sm` up the scene is the arrows-and-name pill (one tap to the next room) with the plain
 * view toggle beside it. A phone has no room for that: three pills overflowed and a centred row
 * could not be scrolled back to its start, so "Ders seç" sat half off screen. There the scene is
 * one chip whose menu holds the rooms and the plain view, and the sound pill is its icon.
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
  const canChange = seatedRoom ? seatedRoom.isOwner : true;

  return (
    <div
      className={`flex w-full flex-col items-center gap-2${isPlain ? "" : " room-stage"}`}
      data-room-theme={isPlain ? undefined : activeTheme}
    >
      {seatedRoom ? <PlanTaskContextChip title={seatedRoom.name} /> : null}
      {/* One glass strip with three segments. `justify-center-safe` on the row: centred while it
          fits, start-aligned (and the strip scrolls) when not, so "Ders seç" is never cut off. */}
      <div className="flex w-full justify-center-safe">
      <div className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-full p-1 session-liquid-pill mentor-scrollarea">
        <SessionSubjectPicker
          value={subject ?? ""}
          onChange={(v) => onSubjectChange(v.trim() ? v.trim() : null)}
          readOnly={readOnlySubject}
        />

        <SegmentDivider />

        <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
          <RoomThemeSwitcher
            theme={activeTheme}
            canChange={canChange}
            busy={themeBusy}
            onChange={onThemeChange}
          />
          <button
            type="button"
            aria-pressed={isPlain}
            aria-label={tRoom(isPlain ? "plain_view_off" : "plain_view_on")}
            title={tRoom(isPlain ? "plain_view_off" : "plain_view_on")}
            onClick={onTogglePlain}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--room-accent)] motion-reduce:transition-none"
            style={{ color: "var(--room-ink-soft)" }}
          >
            {isPlain ? (
              <Wallpaper className="size-[18px]" strokeWidth={2} aria-hidden />
            ) : (
              <Focus className="size-[18px]" strokeWidth={2} aria-hidden />
            )}
          </button>
        </div>

        <SessionSceneMenu
          theme={activeTheme}
          canChange={canChange}
          busy={themeBusy}
          isPlain={isPlain}
          onThemeChange={onThemeChange}
          onTogglePlain={onTogglePlain}
        />

        <SegmentDivider />

        <SessionAmbientPicker
          trackId={ambientTrackId}
          muted={ambientMuted}
          onTrackIdChange={onAmbientTrackChange}
          onToggleMute={onAmbientToggleMute}
        />
      </div>
      </div>
    </div>
  );
}

function SegmentDivider() {
  return <span aria-hidden className="h-6 w-px shrink-0 bg-[var(--play-line)]" />;
}

/** The phone's scene control: one chip, the rooms and the plain view in its menu. */
function SessionSceneMenu({
  theme,
  canChange,
  busy,
  isPlain,
  onThemeChange,
  onTogglePlain,
}: {
  theme: StudyRoomTheme;
  canChange: boolean;
  busy: boolean;
  isPlain: boolean;
  onThemeChange: (next: StudyRoomTheme, direction: 1 | -1) => void;
  onTogglePlain: () => void;
}) {
  const t = useTranslations("session_room");
  const label = isPlain ? t("plain_view_on") : t(`theme_${theme}`);

  return (
    <div className="shrink-0 sm:hidden">
      <PopoverMenu
        align="left"
        panelRole="menu"
        menuClassName="min-w-[13rem] py-1"
        trigger={({ open, setOpen, menuId }) => (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-label={t("scene_menu", { scene: label })}
            onClick={() => setOpen(!open)}
            className={SESSION_CHROME_PILL_CLASS}
            style={SESSION_CHROME_PILL_STYLE}
          >
            <span className="min-w-0 truncate">{label}</span>
            <ChevronDown
              className={`size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
              strokeWidth={2.25}
              aria-hidden
              style={{ color: "var(--color-secondary)" }}
            />
          </button>
        )}
      >
        {canChange
          ? STUDY_ROOM_THEME_IDS.map((id) => (
              <PopoverMenuItem
                key={id}
                selected={!isPlain && id === theme}
                disabled={busy}
                onClick={() => {
                  if (id !== theme) {
                    const from = STUDY_ROOM_THEME_IDS.indexOf(theme);
                    onThemeChange(id, STUDY_ROOM_THEME_IDS.indexOf(id) > from ? 1 : -1);
                  }
                  // Picking a room means wanting to see it.
                  if (isPlain) onTogglePlain();
                }}
              >
                {t(`theme_${id}`)}
              </PopoverMenuItem>
            ))
          : null}
        <PopoverMenuItem onClick={onTogglePlain} className={canChange ? "border-t border-[var(--play-line)]" : undefined}>
          <span className="flex items-center gap-2">
            {isPlain ? (
              <Wallpaper className="size-[18px]" strokeWidth={1.75} aria-hidden />
            ) : (
              <Focus className="size-[18px]" strokeWidth={1.75} aria-hidden />
            )}
            {t(isPlain ? "plain_view_off" : "plain_view_on")}
          </span>
        </PopoverMenuItem>
      </PopoverMenu>
    </div>
  );
}
