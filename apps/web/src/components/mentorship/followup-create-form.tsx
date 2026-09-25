"use client";

import { useRef, useState, type FormEvent } from "react";
import { UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { Button, TextAreaField, TextField } from "@mentor/ui";
import { CoachOverlayBody, CoachOverlayFooter } from "@/components/coach-overlay";
import { DateField } from "@/components/date-field";
import { createFollowup } from "@/lib/mentorship-followups";
import {
  istanbulDate,
  operationForDraft,
  type PendingFollowupOperation,
} from "@/lib/mentorship-followup-state";
import { INSET_GROUP_CLASS, NOTE_CLASS } from "./coach-ui";

/**
 * A follow-up record, written in the report's side panel.
 *
 * The two text boxes look alike but only one reaches the student, so the form is split along that
 * line: the private group first, then the shared decision in its own group with the "shared" cue in
 * the accent. The submit label repeats it, and changes the moment a shared decision is typed.
 */
export function FollowupCreateForm({
  studentId,
  replacesId,
  onSaved,
  onCancel,
}: {
  studentId: string;
  replacesId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const [title, setTitle] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [sharedDecision, setSharedDecision] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<PendingFollowupOperation | null>(null);
  const submitting = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    const draft = {
      title: title.trim(),
      privateNote: privateNote.trim() || null,
      sharedDecision: sharedDecision.trim() || null,
      followUpDate: followUpDate || null,
      replacesId,
    };
    pending.current = operationForDraft(pending.current, draft, () => crypto.randomUUID());
    try {
      await createFollowup(studentId, {
        ...draft,
        operationId: pending.current.operationId,
      });
      onSaved();
    } catch (failure) {
      setError(failure instanceof ApiClientError ? failure.message : common("error_unknown"));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
      <CoachOverlayBody>
        <div className="flex flex-col gap-5 pb-4">
          {replacesId ? <p className={NOTE_CLASS}>{t("followup_replacement_hint")}</p> : null}

          <div className={`${INSET_GROUP_CLASS} flex flex-col gap-4 p-4`}>
            <TextField
              dense
              label={t("followup_title_label")}
              required
              maxLength={120}
              value={title}
              disabled={busy}
              // Focus lands here whether the panel opens on the form or switches to it.
              autoFocus
              data-autofocus=""
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextAreaField
              dense
              label={t("followup_private_label")}
              hint={t("followup_private_hint")}
              rows={3}
              maxLength={2000}
              value={privateNote}
              disabled={busy}
              onChange={(event) => setPrivateNote(event.target.value)}
            />
          </div>

          {/* The shared group wears the selection tint, the same block the record shows it in. */}
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-[var(--play-selected)] p-4">
            <p className="inline-flex items-center gap-1.5 text-caption font-extrabold text-[var(--play-selected-ink)]">
              <UsersRound aria-hidden size={15} strokeWidth={2} />
              {t("followup_shared_hint")}
            </p>
            <TextAreaField
              dense
              label={t("followup_shared_label")}
              rows={3}
              maxLength={2000}
              value={sharedDecision}
              disabled={busy}
              onChange={(event) => setSharedDecision(event.target.value)}
            />
          </div>

          <div className="sm:max-w-64">
            <DateField
              label={t("followup_date_label")}
              value={followUpDate}
              min={istanbulDate()}
              disabled={busy}
              clearLabel={t("followup_date_clear")}
              onChange={setFollowUpDate}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          ) : null}
        </div>
      </CoachOverlayBody>

      <CoachOverlayFooter>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11"
          disabled={busy}
          onClick={onCancel}
        >
          {t("followup_cancel_form")}
        </Button>
        <Button type="submit" size="sm" className="min-h-11" busy={busy} disabled={!title.trim()}>
          {t(sharedDecision.trim() ? "followup_save_share" : "followup_save_private")}
        </Button>
      </CoachOverlayFooter>
    </form>
  );
}
