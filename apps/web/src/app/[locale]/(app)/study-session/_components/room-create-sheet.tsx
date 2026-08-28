"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { StudyRoomTheme } from "@mentor/types";
import {
  STUDY_ROOM_CAPACITY_DEFAULT,
  STUDY_ROOM_CAPACITY_MAX,
  STUDY_ROOM_CAPACITY_MIN,
} from "@/lib/study-room-theme";
import { RoomSheet } from "./room-sheet";
import { RoomThemeCarousel } from "./room-theme-carousel";

/**
 * Creating a table, as a room you walk into. The theme carousel is the banner rather than a
 * field: you pick an atmosphere by seeing it, and the name and seat count are the only two
 * things left to type.
 *
 * This used to be three stacked inputs inside a 288px sidebar rail, where the theme was a
 * `<select>` and nothing about the choice was visible.
 */
export function RoomCreateSheet({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; theme: StudyRoomTheme; capacity: number }) => void;
}) {
  const t = useTranslations("session_room");
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<StudyRoomTheme>("LIBRARY");
  const [capacity, setCapacity] = useState(STUDY_ROOM_CAPACITY_DEFAULT);

  return (
    <RoomSheet
      open={open}
      onClose={onClose}
      title={t("create_title")}
      banner={<RoomThemeCarousel value={theme} onChange={setTheme} disabled={busy} />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || busy) return;
          onSubmit({ name: name.trim(), theme, capacity });
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
            {t("name_label")}
          </span>
          <input
            type="text"
            value={name}
            maxLength={40}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder={t("name_placeholder")}
            className="min-h-12 rounded-[var(--radius-card)] border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ borderColor: "var(--color-progress-track)", color: "var(--color-main)" }}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
            {t("capacity_label")}
          </span>
          {/* A stepper, not a number field: the range is 2–10 and a keyboard is overkill for it. */}
          <div className="flex items-center gap-3">
            <StepperButton
              label={t("capacity_less")}
              disabled={busy || capacity <= STUDY_ROOM_CAPACITY_MIN}
              onClick={() => setCapacity((c) => Math.max(STUDY_ROOM_CAPACITY_MIN, c - 1))}
              icon={<Minus className="size-4" strokeWidth={2.5} aria-hidden />}
            />
            <output
              className="min-w-12 text-center text-2xl font-bold tabular-nums"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              {capacity}
            </output>
            <StepperButton
              label={t("capacity_more")}
              disabled={busy || capacity >= STUDY_ROOM_CAPACITY_MAX}
              onClick={() => setCapacity((c) => Math.min(STUDY_ROOM_CAPACITY_MAX, c + 1))}
              icon={<Plus className="size-4" strokeWidth={2.5} aria-hidden />}
            />
            <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("capacity_hint")}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="min-h-12 w-full cursor-pointer rounded-full text-sm font-bold transition-transform duration-200 hover:scale-[1.01] disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:scale-100"
          style={{ backgroundColor: "var(--color-btn)", color: "var(--color-btn-label)" }}
        >
          {t("create_submit")}
        </button>
      </form>
    </RoomSheet>
  );
}

function StepperButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--color-main)_8%,transparent)] disabled:opacity-40 motion-reduce:transition-none"
      style={{ backgroundColor: "var(--color-surface-container)", color: "var(--color-main)" }}
    >
      {icon}
    </button>
  );
}
