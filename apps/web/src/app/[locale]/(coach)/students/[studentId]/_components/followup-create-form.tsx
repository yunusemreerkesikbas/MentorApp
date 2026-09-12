"use client";

import { useRef, useState } from "react";
import type { MentorshipFollowupDto } from "@mentor/types";
import { createMentorshipFollowupSchema } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, TextAreaField, TextField } from "@mentor/ui";
import { useTranslations } from "next-intl";

import { useMentorToast } from "@/lib/mentor-toast";
import { createMentorshipFollowup } from "@/lib/mentorship-followups";
import {
  istanbulDate,
  operationForDraft,
  type PendingFollowupOperation,
} from "@/lib/mentorship-followup-state";

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function FollowupCreateForm({
  studentId,
  replacement,
  onSaved,
  onCancelReplacement,
}: {
  studentId: string;
  replacement: MentorshipFollowupDto | null;
  onSaved: () => void;
  onCancelReplacement: () => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const [title, setTitle] = useState(replacement?.title ?? "");
  const [privateNote, setPrivateNote] = useState(replacement?.privateNote ?? "");
  const [sharedDecision, setSharedDecision] = useState(replacement?.sharedDecision ?? "");
  const [followUpDate, setFollowUpDate] = useState(replacement?.followUpDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operationRef = useRef<PendingFollowupOperation | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const draft = {
      title: title.trim(),
      privateNote: optionalText(privateNote),
      sharedDecision: optionalText(sharedDecision),
      followUpDate: followUpDate || null,
      replacesId: replacement?.id ?? null,
    };
    const operation = operationForDraft(operationRef.current, draft, () => crypto.randomUUID());
    operationRef.current = operation;
    const parsed = createMentorshipFollowupSchema.safeParse({
      ...draft,
      operationId: operation.operationId,
    });
    if (!parsed.success) {
      setError(t("followup_form_invalid"));
      return;
    }
    if (draft.followUpDate && draft.followUpDate < istanbulDate()) {
      setError(t("followup_date_past"));
      return;
    }

    setBusy(true);
    try {
      await createMentorshipFollowup(studentId, parsed.data);
      operationRef.current = null;
      setTitle("");
      setPrivateNote("");
      setSharedDecision("");
      setFollowUpDate("");
      toast.success({ title: t("followup_saved") });
      onSaved();
    } catch (failure) {
      setError(failure instanceof ApiClientError ? failure.message : common("error_unknown"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--color-main)" }}>
            {replacement ? t("followup_replace_title") : t("followup_create_title")}
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
            {replacement ? t("followup_replace_body") : t("followup_create_body")}
          </p>
        </div>
        <TextField
          label={t("followup_title_label")}
          value={title}
          maxLength={120}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextAreaField
          label={t("followup_private_label")}
          hint={t("followup_private_hint")}
          value={privateNote}
          maxLength={2000}
          rows={4}
          onChange={(event) => setPrivateNote(event.target.value)}
        />
        <TextAreaField
          label={t("followup_shared_label")}
          hint={t("followup_shared_hint")}
          value={sharedDecision}
          maxLength={2000}
          rows={4}
          onChange={(event) => setSharedDecision(event.target.value)}
        />
        <TextField
          type="date"
          label={t("followup_date_label")}
          value={followUpDate}
          min={istanbulDate()}
          onChange={(event) => setFollowUpDate(event.target.value)}
        />
        {error ? (
          <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" busy={busy}>
            {t("followup_save")}
          </Button>
          {replacement ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={onCancelReplacement}>
              {t("followup_replace_cancel")}
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
