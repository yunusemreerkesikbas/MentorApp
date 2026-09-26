"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { setCoachNote } from "@/lib/mentorship";
import { dativeOf } from "@/lib/turkish-case";
import { CoachCheck, useSuccessMoment } from "@/components/mentorship/coach-check";
import { COACH_FAST } from "@/components/mentorship/coach-motion";

const NOTE_MAX = 500;

/**
 * "Notun": the coach's one standing note, shown the way the student reads it on their Koçum
 * screen, and edited in place. One note, replaced on save; deliberately not a thread (roadmap §9).
 *
 * The draft lives in the shell (`draft`, null when not editing), so "Not bırak" in the hero can
 * open it and a panel opening over the page does not lose it. Saving is the card's only button and
 * it is outlined: the page's one filled ledge stays "Haftayı planla".
 *
 * The note and its editor cross-fade; a saved note draws a ✓ on "Kaydet" before the card turns
 * back to the note (Durak F).
 */
export function NoteCard({
  studentId,
  name,
  note,
  draft,
  onDraft,
  onSaved,
}: {
  studentId: string;
  /** The student's first name. */
  name: string;
  note: MentorshipCoachNoteDto | null;
  draft: string | null;
  onDraft: (next: string | null) => void;
  onSaved: (note: MentorshipCoachNoteDto | null) => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const format = useFormatter();
  const toast = useMentorToast();
  const fieldId = useId();
  const [busy, setBusy] = useState(false);
  const success = useSuccessMoment();
  const editing = draft !== null;

  async function save(body: string | null) {
    setBusy(true);
    try {
      await setCoachNote(studentId, body);
      toast.success({ title: body === null ? t("note_cleared") : t("note_saved") });
      // Still busy while the ✓ shows: clearing or cancelling now would race the save.
      if (body !== null) await success.play();
      onSaved(body === null ? null : { body, updatedAt: new Date().toISOString() });
    } catch (err) {
      toast.error({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    } finally {
      setBusy(false);
    }
  }

  const trimmed = draft?.trim() ?? "";

  return (
    <section className={`${PANEL_CARD} coach-reveal flex flex-col gap-3`} aria-labelledby="note-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="note-title" className={PANEL_CARD_TITLE}>
          {t("note_card_title")}
        </h2>
        {note && !editing ? (
          <button type="button" className={`${PANEL_TEXT_LINK} cursor-pointer gap-1.5`} onClick={() => onDraft(note.body)}>
            <PenLine className="size-4" aria-hidden />
            {t("note_edit")}
          </button>
        ) : null}
      </div>

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={editing ? "edit" : note ? "note" : "empty"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={COACH_FAST}
        >
          {editing ? (
            <div className="flex flex-col gap-3">
              {/* Opening the editor, from here or from the hero, puts the caret in it (and scrolls it
                  into view). On mount, not in an effect: the editor arrives after the note fades out. */}
              <TextAreaField
                id={fieldId}
                autoFocus
                readOnly={busy}
                dense
                label={t("note_field_label", { name, dative: dativeOf(name) })}
                hint={`${t("note_field_hint", { name })} · ${draft.length}/${NOTE_MAX}`}
                placeholder={t("note_placeholder")}
                value={draft}
                rows={4}
                maxLength={NOTE_MAX}
                onChange={(event) => onDraft(event.target.value)}
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-11"
                  busy={busy}
                  disabled={success.shown || trimmed === "" || trimmed === (note?.body ?? "")}
                  onClick={() => void save(trimmed)}
                >
                  {success.shown ? <CoachCheck draw className="size-4" /> : null}
                  {t("note_save")}
                </Button>
                <button type="button" className={PANEL_QUIET_LINK} disabled={busy} onClick={() => onDraft(null)}>
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
            <div className="flex flex-col gap-2">
              <blockquote className="whitespace-pre-line break-words rounded-[var(--radius-card)] bg-[var(--coach-accent-soft)] px-3.5 py-3 text-body-sm font-bold text-[var(--coach-accent-ink)]">
                {note.body}
              </blockquote>
              <p className="text-caption font-semibold text-[var(--color-secondary)]">
                {t("note_seen_by", {
                  name,
                  date: format.dateTime(new Date(note.updatedAt), { day: "numeric", month: "long" }),
                })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-body-sm font-semibold text-[var(--color-body)]">{t("note_empty")}</p>
              <button
                type="button"
                className={`${PANEL_TEXT_LINK} cursor-pointer gap-1.5 self-start`}
                onClick={() => onDraft("")}
              >
                <PenLine className="size-4" aria-hidden />
                {t("note_write")}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
