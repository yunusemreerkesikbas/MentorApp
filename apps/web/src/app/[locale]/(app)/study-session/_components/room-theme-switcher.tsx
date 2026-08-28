"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { StudyRoomTheme } from "@mentor/types";
import { STUDY_ROOM_THEME_IDS } from "@/lib/study-room-theme";

/**
 * Theme name with a step arrow either side.
 *
 * Extracted because the room page and the seated session screen now show the same control in
 * the same place — you should be able to change the room from wherever you are standing in it,
 * and two copies of "what is the next theme" is exactly the kind of pair that drifts apart.
 *
 * `canChange` (owner-only, matching the API's rule) collapses it to a plain label rather than
 * disabled arrows: a member is not being denied an action, there is no action for them there.
 */
export function RoomThemeSwitcher({
  theme,
  canChange,
  busy,
  onChange,
}: {
  theme: StudyRoomTheme;
  canChange: boolean;
  busy?: boolean;
  /** `direction` is +1 for the next arrow, -1 for the previous — the backdrop slides that way. */
  onChange: (next: StudyRoomTheme, direction: 1 | -1) => void;
}) {
  const t = useTranslations("session_room");

  const step = (delta: 1 | -1) => {
    const index = STUDY_ROOM_THEME_IDS.indexOf(theme);
    onChange(
      STUDY_ROOM_THEME_IDS[
        (index + delta + STUDY_ROOM_THEME_IDS.length) % STUDY_ROOM_THEME_IDS.length
      ]!,
      // Travel follows the control, not the list order: "next" moves the same way when it
      // wraps from HOME back to LIBRARY as it does anywhere else.
      delta,
    );
  };

  return (
    <div className="flex items-center justify-center gap-1">
      {canChange ? (
        <StepArrow
          direction="prev"
          label={t("theme_prev")}
          busy={busy}
          onClick={() => step(-1)}
        />
      ) : null}
      {/* Fixed width: "Ev" and "Kütüphane" are 2 and 9 characters, so an auto-width label made
          the whole control resize under the cursor — the arrow you were about to press moved.
          Wide enough for the longest name in either locale. */}
      <span
        className="w-[6.5rem] truncate text-center text-sm font-semibold"
        style={{ color: "var(--room-ink-soft)" }}
      >
        {t(`theme_${theme}`)}
      </span>
      {canChange ? (
        <StepArrow direction="next" label={t("theme_next")} busy={busy} onClick={() => step(1)} />
      ) : null}
    </div>
  );
}

function StepArrow({
  direction,
  label,
  busy,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  busy?: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity duration-200 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--room-accent)] disabled:opacity-40 motion-reduce:transition-none"
      style={{ color: "var(--room-ink-soft)", opacity: 0.8 }}
    >
      <Icon className="size-[18px]" strokeWidth={2.5} aria-hidden />
    </button>
  );
}
