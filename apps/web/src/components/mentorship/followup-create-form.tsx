"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { createFollowup } from "@/lib/mentorship-followups";
import { istanbulDate, operationForDraft, type PendingFollowupOperation } from "@/lib/mentorship-followup-state";

const fieldClass = "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-main)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]";

export function FollowupCreateForm({ studentId, replacesId, onSaved, onCancel }: {
  studentId: string; replacesId: string | null; onSaved: () => void; onCancel: () => void;
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
    const draft = { title: title.trim(), privateNote: privateNote.trim() || null, sharedDecision: sharedDecision.trim() || null, followUpDate: followUpDate || null, replacesId };
    pending.current = operationForDraft(pending.current, draft, () => crypto.randomUUID());
    try {
      await createFollowup(studentId, { ...draft, operationId: pending.current.operationId });
      onSaved();
    } catch (failure) {
      setError(failure instanceof ApiClientError ? failure.message : common("error_unknown"));
    } finally { submitting.current = false; setBusy(false); }
  }

  return <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-4">
    {replacesId && <p className="text-sm">{t("followup_replacement_hint")}</p>}
    <label className="flex flex-col gap-1 text-sm">{t("followup_title_label")}
      <input autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} disabled={busy} />
    </label>
    <label className="flex flex-col gap-1 text-sm">{t("followup_private_label")}
      <span className="text-xs text-[var(--color-secondary)]">{t("followup_private_hint")}</span>
      <textarea rows={3} maxLength={2000} value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} className={fieldClass} disabled={busy} />
    </label>
    <label className="flex flex-col gap-1 text-sm">{t("followup_shared_label")}
      <span className="text-xs text-[var(--color-secondary)]">{t("followup_shared_hint")}</span>
      <textarea rows={3} maxLength={2000} value={sharedDecision} onChange={(event) => setSharedDecision(event.target.value)} className={fieldClass} disabled={busy} />
    </label>
    <label className="flex flex-col gap-1 text-sm">{t("followup_date_label")}
      <input type="date" min={istanbulDate()} value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className={fieldClass} disabled={busy} />
    </label>
    {error && <p role="alert">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" busy={busy} disabled={!title.trim()}>{t(sharedDecision.trim() ? "followup_save_share" : "followup_save_private")}</Button>
      <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>{t("followup_cancel_form")}</Button>
    </div>
  </form>;
}
