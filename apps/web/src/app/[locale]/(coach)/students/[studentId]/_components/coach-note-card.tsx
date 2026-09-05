"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipCoachNoteDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, TextAreaField } from "@mentor/ui";
import { useMentorToast } from "@/lib/mentor-toast";
import { setCoachNote } from "@/lib/mentorship";

/**
 * The coach's standing note to one student, shown on the student's own `/kocum` screen.
 *
 * One note, replaced on save. Deliberately not a thread: Phase-2 communication stays off-platform
 * and in-app chat is Phase 3 (roadmap §9). This exists so "focus on paragraphs this week" does not
 * have to be smuggled into a task title, and it carries nothing of the student's back to the coach.
 */
const NOTE_MAX = 500;

export function CoachNoteCard({
  studentId,
  note,
  onSaved,
}: {
  studentId: string;
  note: MentorshipCoachNoteDto | null;
  onSaved: () => void;
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

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
        {t("note_title")}
      </h2>
      <p className="mb-3 text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("note_body")}
      </p>
      <TextAreaField
        label={t("note_title")}
        placeholder={t("note_placeholder")}
        value={body}
        rows={3}
        maxLength={NOTE_MAX}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          busy={busy}
          disabled={trimmed === "" || trimmed === (note?.body ?? "")}
          onClick={() => void save(trimmed)}
        >
          {t("note_save")}
        </Button>
        {note ? (
          <Button type="button" variant="ghost" busy={busy} onClick={() => void save(null)}>
            {t("note_clear")}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
