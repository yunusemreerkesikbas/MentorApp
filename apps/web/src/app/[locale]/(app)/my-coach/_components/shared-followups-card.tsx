"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card } from "@mentor/ui";
import type { MentorshipSharedFollowupDto } from "@mentor/types";
import { fetchSharedFollowups, respondToFollowup } from "@/lib/mentorship-followups";
import { useFollowupPage } from "@/components/mentorship/use-followup-page";
import { FollowupPageState, FollowupPagination } from "@/components/mentorship/followup-page-state";
import { FollowupStatus } from "@/components/mentorship/followup-status";

export function SharedFollowupsCard() {
  const t = useTranslations("mentorship");
  const load = useCallback((page: number, signal: AbortSignal) => fetchSharedFollowups(page, 10, signal), []);
  const resource = useFollowupPage<MentorshipSharedFollowupDto>(load);
  const [busy, setBusy] = useState<string | null>(null);
  const locked = useRef(false);
  async function respond(item: MentorshipSharedFollowupDto, response: "ACCEPTED" | "CHANGE_REQUESTED") {
    if (locked.current) return;
    locked.current = true;
    setBusy(item.id);
    try { await respondToFollowup(item.id, { version: item.version, response }); resource.reload(); }
    catch (failure) { resource.showError(failure); }
    finally { locked.current = false; setBusy(null); }
  }
  if (resource.enabled === false) return null;
  return <Card>
    <h2 className="text-base font-semibold">{t("followup_shared_title")}</h2>
    <p className="my-2 text-sm text-[var(--color-secondary)]">{t("followup_shared_body")}</p>
    <FollowupPageState loading={resource.loading} error={resource.error} retry={resource.reload}>
      {resource.data?.items.length === 0 && <p>{t("followup_shared_empty")}</p>}
      {resource.data?.items.map((item) => <article key={item.id} className="flex flex-col gap-3 border-t border-[var(--color-border)] py-4">
        <p className="whitespace-pre-wrap break-words">{item.sharedDecision}</p>
        <FollowupStatus status={item.status} response={item.response} shared />
        {item.followUpDate && <p className="text-sm">{t("followup_due", { date: item.followUpDate })}</p>}
        {item.status === "OPEN" && <div className="flex flex-wrap gap-2">
          <Button variant="secondary" busy={busy === item.id} disabled={busy !== null || item.response === "ACCEPTED"} onClick={() => void respond(item, "ACCEPTED")}>{t("followup_accept")}</Button>
          <Button variant="secondary" disabled={busy !== null || item.response === "CHANGE_REQUESTED"} onClick={() => void respond(item, "CHANGE_REQUESTED")}>{t("followup_request_change")}</Button>
        </div>}
      </article>)}
      {resource.data && <FollowupPagination {...resource.data} onChange={resource.setPage} />}
    </FollowupPageState>
  </Card>;
}
