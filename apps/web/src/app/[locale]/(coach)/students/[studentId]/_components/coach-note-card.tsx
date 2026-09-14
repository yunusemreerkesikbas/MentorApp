"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipCoachNoteDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, TextAreaField } from "@mentor/ui";
import { CoachOverlayBody, CoachOverlayFooter } from "@/components/coach-overlay";
import { INSET_GROUP_CLASS } from "@/components/mentorship/coach-ui";
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
 * where the actions move to the panel footer.
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
    <TextAreaField
      dense
      label={t("note_title")}
      hint={t("note_body")}
      placeholder={t("note_placeholder")}
      value={body}
      rows={4}
      maxLength={NOTE_MAX}
      data-autofocus={inPanel ? "" : undefined}
      onChange={(event) => setBody(event.target.value)}
    />
  );
  const actions = (
    <>
      {note ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          disabled={busy}
          onClick={() => void save(null)}
        >
          {t("note_clear")}
        </Button>
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
        <CoachOverlayBody>
          <div className="pb-4">{field}</div>
        </CoachOverlayBody>
        <CoachOverlayFooter>{actions}</CoachOverlayFooter>
      </>
    );
  }

  return (
    <div className={`${INSET_GROUP_CLASS} flex flex-col gap-3 p-4`}>
      {field}
      <div className={`flex flex-wrap items-center gap-2 ${note ? "justify-between" : "justify-end"}`}>
        {actions}
      </div>
    </div>
  );
}
