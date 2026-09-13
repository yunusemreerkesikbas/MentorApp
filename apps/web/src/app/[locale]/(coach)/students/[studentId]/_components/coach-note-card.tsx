"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipCoachNoteDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import {
  COACH_FIELD_CLASS,
  INSET_GROUP_CLASS,
  PANEL_BODY_CLASS,
  PANEL_FOOTER_CLASS,
  TextButton,
} from "@/components/mentorship/coach-ui";
import { useMentorToast } from "@/lib/mentor-toast";
import { setCoachNote } from "@/lib/mentorship";

/**
 * The coach's standing note to one student, shown on the student's own `/kocum` screen.
 *
 * One note, replaced on save. Deliberately not a thread: Phase-2 communication stays off-platform
 * and in-app chat is Phase 3 (roadmap §9). This exists so "focus on paragraphs this week" does not
 * have to be smuggled into a task title, and it carries nothing of the student's back to the coach.
 *
 * Two homes: a group in the desktop action rail, and the body of the side panel on narrower screens,
 * where the panel's own title names it and the actions move to the panel footer.
 */
const NOTE_MAX = 500;

export function CoachNoteCard({
  studentId,
  note,
  onSaved,
  inPanel = false,
}: {
  studentId: string;
  note: MentorshipCoachNoteDto | null;
  onSaved: () => void;
  inPanel?: boolean;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const headingId = useId();
  const hintId = useId();
  const [body, setBody] = useState(note?.body ?? "");
  const [busy, setBusy] = useState(false);

  async function save(next: string | null) {
    setBusy(true);
    try {
      await setCoachNote(studentId, next);
      setBody(next ?? "");
      toast.success({ title: next === null ? t("note_cleared") : t("note_saved") });
      onSaved();
    } catch (err) {
      toast.error({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    } finally {
      setBusy(false);
    }
  }

  const trimmed = body.trim();

  const field = (
    <textarea
      aria-labelledby={inPanel ? undefined : headingId}
      aria-label={inPanel ? t("note_title") : undefined}
      aria-describedby={hintId}
      data-autofocus={inPanel ? "" : undefined}
      placeholder={t("note_placeholder")}
      value={body}
      rows={4}
      maxLength={NOTE_MAX}
      onChange={(event) => setBody(event.target.value)}
      className={`${COACH_FIELD_CLASS} resize-y`}
    />
  );
  const hint = (
    <p id={hintId} className="coach-footnote text-[var(--color-secondary)]">
      {t("note_body")}
    </p>
  );
  const actions = (
    <>
      {note ? (
        <TextButton tone="muted" disabled={busy} onClick={() => void save(null)}>
          {t("note_clear")}
        </TextButton>
      ) : null}
      <Button
        type="button"
        size="sm"
        className="min-h-11"
        busy={busy}
        disabled={trimmed === "" || trimmed === (note?.body ?? "")}
        onClick={() => void save(trimmed)}
      >
        {t("note_save")}
      </Button>
    </>
  );

  if (inPanel) {
    return (
      <>
        <div className={PANEL_BODY_CLASS}>
          {field}
          {hint}
        </div>
        <div className={`${PANEL_FOOTER_CLASS} justify-end`}>{actions}</div>
      </>
    );
  }

  return (
    <section aria-labelledby={headingId} className={`${INSET_GROUP_CLASS} flex flex-col gap-2.5 p-4`}>
      <h2 id={headingId} className="coach-headline text-[var(--color-main)]">
        {t("note_title")}
      </h2>
      {field}
      {hint}
      <div className={`flex flex-wrap items-center gap-2 ${note ? "justify-between" : "justify-end"}`}>
        {actions}
      </div>
    </section>
  );
}
