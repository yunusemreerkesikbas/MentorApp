"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipFollowupDto } from "@mentor/types";
import { Button } from "@mentor/ui";
import { updateFollowup } from "@/lib/mentorship-followups";
import { istanbulDate } from "@/lib/mentorship-followup-state";
import { FollowupStatus } from "./followup-status";

export function CoachFollowupItem({ item, onChanged, onError, onReplace }: {
  item: MentorshipFollowupDto; onChanged: () => void; onError: (error: unknown) => void; onReplace: () => void;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const [date, setDate] = useState(item.followUpDate ?? "");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  async function mutate(status?: "COMPLETED" | "CANCELLED") {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await updateFollowup(item.studentId, item.id, { version: item.version, ...(status ? { status } : { followUpDate: date || null }) });
      onChanged();
    } catch (failure) { onError(failure); }
    finally { locked.current = false; setBusy(false); }
  }
  return <article className="flex flex-col gap-3 border-t border-[var(--color-border)] py-4">
    <h3 className="font-semibold">{item.title}</h3>
    <p className="text-xs text-[var(--color-secondary)]">{new Date(item.createdAt).toLocaleDateString(locale)}</p>
    <FollowupStatus status={item.status} response={item.response} shared={item.sharedDecision !== null} />
    {item.privateNote && <div><p className="text-xs font-semibold">{t("followup_private_hint")}</p><p className="whitespace-pre-wrap break-words text-sm">{item.privateNote}</p></div>}
    {item.sharedDecision && <div><p className="text-xs font-semibold">{t("followup_shared_hint")}</p><p className="whitespace-pre-wrap break-words text-sm">{item.sharedDecision}</p></div>}
    {item.replacesId && <p className="text-xs">{t("followup_replacement_hint")}</p>}
    {item.status === "OPEN" ? <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">{t("followup_date_label")}
        <input type="date" min={istanbulDate()} value={date} disabled={busy} onChange={(event) => setDate(event.target.value)} className="min-h-11 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" busy={busy} disabled={date === (item.followUpDate ?? "")} onClick={() => void mutate()}>{t("followup_reschedule")}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void mutate("COMPLETED")}>{t("followup_complete")}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void mutate("CANCELLED")}>{t("followup_cancel")}</Button>
      </div>
    </div> : <Button variant="secondary" onClick={onReplace}>{t("followup_replace")}</Button>}
  </article>;
}
