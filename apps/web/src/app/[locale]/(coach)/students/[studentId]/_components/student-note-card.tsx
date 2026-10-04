"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { MentorshipCoachNoteDto } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { genitiveOf } from "@/lib/turkish-case";

/**
 * What the student wrote for this coach on their Koçum screen (QA F4, 2026-09-27). Read-only: the
 * coach answers in their own note or off-platform, since this is not a thread (roadmap §9). Drawn
 * apart from the coach's accent so the two voices never read as one.
 */
export function StudentNoteCard({ name, note }: { name: string; note: MentorshipCoachNoteDto }) {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  return (
    <section className={`${PANEL_CARD} coach-reveal flex flex-col gap-2`} aria-labelledby="student-note-title">
      <h2 id="student-note-title" className={PANEL_CARD_TITLE}>
        {t("student_note_card_title", { name, genitive: genitiveOf(name) })}
      </h2>
      <blockquote className="whitespace-pre-line break-words rounded-[var(--radius-card)] bg-[var(--color-surface-container)] px-3.5 py-3 text-body-sm font-semibold text-[var(--color-main)]">
        {note.body}
      </blockquote>
      <p className="text-caption font-semibold text-[var(--color-secondary)]">
        {t("student_note_written", {
          date: format.dateTime(new Date(note.updatedAt), { day: "numeric", month: "long" }),
        })}
      </p>
    </section>
  );
}
