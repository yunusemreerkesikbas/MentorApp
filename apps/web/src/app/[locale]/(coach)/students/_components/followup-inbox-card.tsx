"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { Clock, MessageSquare } from "lucide-react";
import type { MentorshipFollowupDto } from "@mentor/types";
import { FollowupPageState, FollowupPagination } from "@/components/mentorship/followup-page-state";
import { useFollowupPage } from "@/components/mentorship/use-followup-page";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { fetchMentorshipFollowups } from "@/lib/mentorship-followups";
import { useFollowupDue } from "../../_components/followup-due";
import { StudentAvatar } from "../../_components/student-avatar";

/**
 * The follow-ups that want the coach today: a check that is due, or a student who asked for a
 * change. Drawn only once the feature is known to be on, so a coach without it never sees a card
 * flash in and vanish.
 */
export function FollowupInboxCard() {
  const t = useTranslations("mentorship");
  const load = useCallback(
    (page: number, signal: AbortSignal) =>
      fetchMentorshipFollowups({ view: "ACTIONABLE", page, pageSize: 5 }, signal),
    [],
  );
  const resource = useFollowupPage<MentorshipFollowupDto>(load);
  if (resource.enabled !== true) return null;

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-2`} aria-labelledby="followups-title">
      <h2 id="followups-title" className={PANEL_CARD_TITLE}>
        {t("followup_inbox_title")}
      </h2>
      <FollowupPageState loading={resource.loading} error={resource.error} retry={resource.reload}>
        {resource.data?.items.length === 0 ? (
          <p className="text-body-sm text-[var(--color-secondary)]">{t("followup_inbox_empty")}</p>
        ) : (
          <ul className="flex flex-col">
            {resource.data?.items.map((item) => (
              <li key={item.id} className="border-t border-[var(--play-line)] first:border-t-0">
                <Link
                  href={{ pathname: "/students/[studentId]", params: { studentId: item.studentId } }}
                  className="flex items-start gap-3 rounded-[var(--radius-card)] py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <StudentAvatar name={item.studentDisplayName} src={null} size={32} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-body-sm font-extrabold text-[var(--color-main)]">
                      {item.studentDisplayName}
                    </span>
                    <span className="text-caption font-semibold leading-snug text-[var(--color-body)]">
                      {item.title}
                    </span>
                    <FollowupDue item={item} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {resource.data ? <FollowupPagination {...resource.data} onChange={resource.setPage} /> : null}
      </FollowupPageState>
    </section>
  );
}

/** Why it is here: the student asked for a change, or the check is due, in the coach's calendar. */
function FollowupDue({ item }: { item: MentorshipFollowupDto }) {
  const t = useTranslations("mentorship");
  const due = useFollowupDue();
  const changes = item.response === "CHANGE_REQUESTED";
  const label = changes ? t("followup_changes_requested") : due(item.followUpDate);
  const Icon = changes ? MessageSquare : Clock;

  return (
    <span
      className={`mt-0.5 inline-flex items-center gap-1.5 text-xs font-extrabold ${changes ? "text-[var(--play-selected-ink)]" : "text-[var(--color-secondary)]"}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
