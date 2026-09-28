"use client";

import { useId, useState } from "react";
import { PenLine } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { MentorshipCoachNoteDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, TextAreaField } from "@mentor/ui";
import {
  PANEL_CARD,
  PANEL_CARD_TITLE,
  PANEL_QUIET_LINK,
  PANEL_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { useMentorToast } from "@/lib/mentor-toast";
import { setMyNote } from "@/lib/mentorship";

const NOTE_MAX = 500;

/**
 * The student's one standing note to their coach (QA F4, 2026-09-27), the mirror of "Koçundan not":
 * replaced on save, never a thread (roadmap §9). The coach reads it on the student's report.
 */
export function MyNoteCard({
  note,
  onSaved,
}: {
  note: MentorshipCoachNoteDto | null;
  onSaved: (note: MentorshipCoachNoteDto | null) => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const format = useFormatter();
  const toast = useMentorToast();
  const titleId = useId();
  const fieldId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmed = draft?.trim() ?? "";

  async function save(body: string | null) {
    setBusy(true);
    try {
      await setMyNote(body);
      toast.success({ title: body === null ? t("note_cleared") : t("note_saved") });
      onSaved(body === null ? null : { body, updatedAt: new Date().toISOString() });
      setDraft(null);
    } catch (err) {
      toast.error({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={titleId} className={`${PANEL_CARD} flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className={PANEL_CARD_TITLE}>
          {t("my_note_title")}
        </h2>
        {note && draft === null ? (
          <button type="button" className={`${PANEL_TEXT_LINK} cursor-pointer`} onClick={() => setDraft(note.body)}>
            <PenLine aria-hidden className="size-4" strokeWidth={1.75} />
            {t("note_edit")}
          </button>
        ) : null}
      </div>
      {draft !== null ? (
        <div className="flex flex-col gap-3">
          <TextAreaField
            id={fieldId}
            autoFocus
            readOnly={busy}
            dense
            label={t("my_note_title")}
            hint={`${t("my_note_hint")} · ${draft.length}/${NOTE_MAX}`}
            placeholder={t("my_note_placeholder")}
            value={draft}
            rows={4}
            maxLength={NOTE_MAX}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11"
              busy={busy}
              disabled={trimmed === "" || trimmed === (note?.body ?? "")}
              onClick={() => void save(trimmed)}
            >
              {t("note_save")}
            </Button>
            <button type="button" className={PANEL_QUIET_LINK} disabled={busy} onClick={() => setDraft(null)}>
              {t("confirm_cancel")}
            </button>
            {note ? (
              <button
                type="button"
                className={`${PANEL_QUIET_LINK} ml-auto`}
                disabled={busy}
                onClick={() => void save(null)}
              >
                {t("note_clear")}
              </button>
            ) : null}
          </div>
        </div>
      ) : note ? (
        <>
          {/* The student's own voice: a neutral block, never the coach ink. */}
          <p className="whitespace-pre-line break-words rounded-[var(--radius-card)] bg-[var(--color-surface-container)] px-3.5 py-3 text-body-sm font-bold text-[var(--color-main)]">
            {note.body}
          </p>
          <p className="text-caption font-semibold text-[var(--color-secondary)]">
            {t("my_note_seen", {
              date: format.dateTime(new Date(note.updatedAt), { day: "numeric", month: "long" }),
            })}
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("my_note_empty")}</p>
          <button
            type="button"
            className={`${PANEL_TEXT_LINK} cursor-pointer self-start`}
            onClick={() => setDraft("")}
          >
            {t("note_write")}
          </button>
        </div>
      )}
    </section>
  );
}
