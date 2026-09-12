"use client";

import { useCallback } from "react";
import { Card } from "@mentor/ui";
import { useTranslations } from "next-intl";
import type { MentorshipFollowupDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { fetchMentorshipFollowups } from "@/lib/mentorship-followups";
import { FollowupStatus } from "@/components/mentorship/followup-status";
import { useFollowupPage } from "@/components/mentorship/use-followup-page";
import { FollowupPageState, FollowupPagination } from "@/components/mentorship/followup-page-state";

export function FollowupInboxCard() {
  const t = useTranslations("mentorship");
  const load = useCallback((page: number, signal: AbortSignal) => fetchMentorshipFollowups({ view: "ACTIONABLE", page, pageSize: 5 }, signal), []);
  const resource = useFollowupPage<MentorshipFollowupDto>(load);
  if (resource.enabled === false) return null;
  return <Card>
    <h2 className="text-base font-semibold">{t("followup_inbox_title")}</h2>
    <p className="my-2 text-sm text-[var(--color-secondary)]">{t("followup_inbox_body")}</p>
    <FollowupPageState loading={resource.loading} error={resource.error} retry={resource.reload}>
      {resource.data?.items.length === 0 && <p>{t("followup_inbox_empty")}</p>}
      <ul>
        {resource.data?.items.map((item) => <li key={item.id} className="border-t border-[var(--color-border)] py-4">
          <Link href={{ pathname: "/students/[studentId]", params: { studentId: item.studentId } }} className="block min-h-11 rounded-[var(--radius-card)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]">
            <p className="font-semibold">{item.studentDisplayName}</p>
            <p className="mb-2 text-sm">{item.title}</p>
            <FollowupStatus status={item.status} response={item.response} shared={item.sharedDecision !== null} />
            <p className="mt-2 text-xs">{item.followUpDate ? t("followup_due", { date: item.followUpDate }) : t("followup_no_date")}</p>
          </Link>
        </li>)}
      </ul>
      {resource.data && <FollowupPagination {...resource.data} onChange={resource.setPage} />}
    </FollowupPageState>
  </Card>;
}
