"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { StudyRoomTheme } from "@mentor/types";
import { Button, TextField } from "@mentor/ui";
import { PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
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
  error = null,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  /** Why the last attempt failed, said above the actions; the sheet stays open. */
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: { name: string; theme: StudyRoomTheme; capacity: number }) => void;
}) {
  const t = useTranslations("session_room");
  const capacityLabelId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<StudyRoomTheme>("LIBRARY");
  const [capacity, setCapacity] = useState(STUDY_ROOM_CAPACITY_DEFAULT);

  return (
    <RoomSheet
      open={open}
      onClose={onClose}
      title={t("create_title")}
      banner={<RoomThemeCarousel value={theme} onChange={setTheme} disabled={busy} />}
      initialFocusRef={nameRef}
      closeDisabled={busy}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        onSubmit({ name: name.trim(), theme, capacity });
      }}
      footer={
        <>
          {/* Phones close from the handle row's X; a second way out would crowd the ledge. */}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${PANEL_QUIET_LINK} max-lg:hidden`}
          >
            {t("cancel")}
          </button>
          <Button type="submit" busy={busy} disabled={!name.trim()} className="max-lg:w-full">
            {t("create_submit")}
          </Button>
        </>
      }
    >
      <TextField
        ref={nameRef}
        label={t("name_label")}
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("name_placeholder")}
        autoComplete="off"
      />

      <div className="flex flex-col gap-1">
        <span id={capacityLabelId} className="text-xs font-semibold text-[var(--color-secondary)]">
          {t("capacity_label")}
        </span>
        {/* A stepper, not a number field: the range is 2–10 and a keyboard is overkill for it. */}
        <div role="group" aria-labelledby={capacityLabelId} className="flex items-center gap-3.5">
          <StepperButton
            label={t("capacity_less")}
            disabled={busy || capacity <= STUDY_ROOM_CAPACITY_MIN}
            onClick={() => setCapacity((c) => Math.max(STUDY_ROOM_CAPACITY_MIN, c - 1))}
            icon={<Minus className="size-5" strokeWidth={1.75} aria-hidden />}
          />
          <output
            aria-live="polite"
            className="min-w-10 text-center text-2xl font-extrabold tabular-nums text-[var(--color-main)]"
          >
            {capacity}
          </output>
          <StepperButton
            label={t("capacity_more")}
            disabled={busy || capacity >= STUDY_ROOM_CAPACITY_MAX}
            onClick={() => setCapacity((c) => Math.min(STUDY_ROOM_CAPACITY_MAX, c + 1))}
            icon={<Plus className="size-5" strokeWidth={1.75} aria-hidden />}
          />
          <span className="text-body-sm font-semibold text-[var(--color-secondary)]">
            {t("capacity_hint")}
          </span>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-body-sm font-semibold text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
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
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--color-main)] transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
    >
      {icon}
    </button>
  );
}
