"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card } from "@mentor/ui";
import type { MentorshipFollowupDto } from "@mentor/types";
import { fetchMentorshipFollowups } from "@/lib/mentorship-followups";
import { useFollowupPage } from "./use-followup-page";
import { FollowupPageState, FollowupPagination } from "./followup-page-state";
import { FollowupCreateForm } from "./followup-create-form";
import { CoachFollowupItem } from "./coach-followup-item";

export function CoachFollowupsCard({ studentId }: { studentId: string }) {
  const t = useTranslations("mentorship");
  const load = useCallback((page: number, signal: AbortSignal) => fetchMentorshipFollowups({ studentId, view: "ALL", page, pageSize: 10 }, signal), [studentId]);
  const resource = useFollowupPage<MentorshipFollowupDto>(load);
  const [form, setForm] = useState<{ replacesId: string | null } | null>(null);
  const actions = useRef<HTMLDivElement>(null);
  function closeForm() { setForm(null); requestAnimationFrame(() => actions.current?.querySelector("button")?.focus()); }
  if (resource.enabled === false) return null;
  return <Card>
    <h2 className="text-base font-semibold">{t("followup_history_title")}</h2>
    <p className="my-2 text-sm text-[var(--color-secondary)]">{t("followup_history_body")}</p>
    <div ref={actions}>{resource.enabled && !form && <Button onClick={() => setForm({ replacesId: null })}>{t("followup_create")}</Button>}</div>
    {resource.enabled && form && <FollowupCreateForm key={form.replacesId ?? "new"} studentId={studentId} replacesId={form.replacesId} onCancel={closeForm} onSaved={() => { closeForm(); resource.setPage(1); resource.reload(); }} />}
    <div className="mt-4">
      <FollowupPageState loading={resource.loading} error={resource.error} retry={resource.reload}>
        {resource.data?.items.length === 0 && <p>{t("followup_history_empty")}</p>}
        {resource.data?.items.map((item) => <CoachFollowupItem key={`${item.id}:${item.version}`} item={item} onChanged={resource.reload} onError={resource.showError} onReplace={() => setForm({ replacesId: item.id })} />)}
        {resource.data && <FollowupPagination {...resource.data} onChange={resource.setPage} />}
      </FollowupPageState>
    </div>
  </Card>;
}
