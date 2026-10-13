"use client";
import { ChevronDown, Music2, Volume2, VolumeX } from "lucide-react";

import { useTranslations } from "next-intl";
import { AMBIENT_TRACK_IDS, type AmbientTrackId } from "@/lib/ambient-tracks";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import {
  SESSION_CHROME_PILL_CLASS,
  SESSION_CHROME_PILL_STYLE,
} from "./session-chrome-pill";

export interface SessionAmbientPickerProps {
  trackId: AmbientTrackId;
  muted: boolean;
  onTrackIdChange: (trackId: AmbientTrackId) => void;
  onToggleMute: () => void;
}

const TRACK_LABEL_KEYS: Record<AmbientTrackId, string> = {
  scene: "track_scene",
  library: "track_library",
  cafe: "track_cafe",
  home: "track_home",
  off: "track_off",
};

/**
 * Pill dropdown for the room sound + mute (idle and focus). "Sahneye uygun" follows the scene;
 * a room's name pins that room's sound wherever you sit.
 */
export function SessionAmbientPicker({
  trackId,
  muted,
  onTrackIdChange,
  onToggleMute,
}: SessionAmbientPickerProps) {
  const translate = useTranslations("session_ambient");
  const trackLabel = translate(TRACK_LABEL_KEYS[trackId]);

  return (
    <PopoverMenu
      align="right"
      panelRole="menu"
      menuClassName="min-w-[13rem]"
      trigger={({ open, setOpen, menuId }) => (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={translate("picker_label")}
          onClick={() => setOpen(!open)}
          // A phone shows the icon alone: the top bar's three pills fit one row only that way.
          className={`${SESSION_CHROME_PILL_CLASS} max-sm:w-11 max-sm:justify-center max-sm:px-0`}
          style={SESSION_CHROME_PILL_STYLE}
        >
          <Music2 className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="min-w-0 truncate max-sm:sr-only">{trackLabel}</span>
          <ChevronDown
            className={`size-4 shrink-0 transition-transform duration-200 max-sm:hidden motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
            strokeWidth={2.25}
            aria-hidden
            style={{ color: "var(--color-secondary)" }}
          />
        </button>
      )}
    >
      {AMBIENT_TRACK_IDS.map((id) => (
        <PopoverMenuItem
          key={id}
          selected={trackId === id}
          onClick={() => onTrackIdChange(id)}
          className={id === "off" ? "border-t border-[var(--play-line)]" : undefined}
        >
          {translate(TRACK_LABEL_KEYS[id])}
        </PopoverMenuItem>
      ))}
      {trackId !== "off" ? (
        <PopoverMenuItem
          role="menuitem"
          onClick={onToggleMute}
          closeOnClick={false}
        >
          <span className="flex items-center gap-2">
            {muted ? (
              <VolumeX className="size-4" aria-hidden />
            ) : (
              <Volume2 className="size-4" aria-hidden />
            )}
            {muted ? translate("unmute") : translate("mute")}
          </span>
        </PopoverMenuItem>
      ) : null}
    </PopoverMenu>
  );
}
