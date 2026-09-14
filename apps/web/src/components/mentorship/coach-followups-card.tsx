"use client";

import { useCallback, useId, useMemo } from "react";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import type { MentorshipFollowupDto } from "@mentor/types";
import { fetchMentorshipFollowups } from "@/lib/mentorship-followups";
import { CoachOverlayBody } from "@/components/coach-overlay";
import { INSET_GROUP_CLASS, NOTE_CLASS } from "./coach-ui";
import { CoachFollowupItem } from "./coach-followup-item";
import { FollowupCreateForm } from "./followup-create-form";
import { FollowupPageState, FollowupPagination } from "./followup-page-state";
import { FollowupStatus } from "./followup-status";
import { useFollowupPage } from "./use-followup-page";

const PAGE_SIZE = 10;
/** The rail is a glance, not the history: two open records, then the panel. */
const RAIL_ITEMS = 2;

export type FollowupCompose = { replacesId: string | null };

/**
 * One read of this student's follow-ups, shared by the rail summary and the panel history: the two
 * can never disagree, and opening the panel costs no second request.
 */
export function useCoachFollowups(studentId: string) {
  const load = useCallback(
    (page: number, signal: AbortSignal) =>
      fetchMentorshipFollowups({ studentId, view: "ALL", page, pageSize: PAGE_SIZE }, signal),
    [studentId],
  );
  return useFollowupPage<MentorshipFollowupDto>(load);
}

export type CoachFollowups = ReturnType<typeof useCoachFollowups>;

function useDueLabel() {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  return useMemo(() => {
    // A follow-up date is a calendar day; formatting it in UTC keeps it on the right day.
    const format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" });
    return (item: MentorshipFollowupDto) =>
      item.followUpDate
        ? t("followup_due", { date: format.format(new Date(`${item.followUpDate}T00:00:00.000Z`)) })
        : t("followup_no_date");
  }, [locale, t]);
}

/** The desktop rail's follow-up group: what is still open, and the two ways in. */
export function CoachFollowupsSummary({
  resource,
  onCreate,
  onOpenHistory,
}: {
  resource: CoachFollowups;
  onCreate: () => void;
  onOpenHistory: () => void;
}) {
  const t = useTranslations("mentorship");
  const headingId = useId();
  const dueLabel = useDueLabel();
  if (resource.enabled === false) return null;

  const total = resource.data?.total ?? 0;
  // ponytail: reads the page the history is on; a coach paging the panel sees the rail follow.
  const open = (resource.data?.items ?? []).filter((item) => item.status === "OPEN").slice(0, RAIL_ITEMS);

  return (
    <section aria-labelledby={headingId} className={`${INSET_GROUP_CLASS} flex flex-col`}>
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3.5">
        <h2 id={headingId} className="coach-headline text-[var(--color-main)]">
          {t("followup_recent_title")}
        </h2>
        {total > 0 ? (
          <span className="coach-footnote tabular-nums text-[var(--color-secondary)]">
            {t("followup_total", { count: total })}
          </span>
        ) : null}
      </div>
      <div className="px-4 py-2">
        <FollowupPageState loading={resource.loading} error={resource.error} retry={resource.reload}>
          {open.length === 0 ? (
            <p className="coach-body text-[var(--color-secondary)]">
              {total > 0 ? t("followup_none_open") : t("followup_history_empty")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-border)]">
              {open.map((item) => (
                <li key={item.id} className="flex flex-col gap-1.5 py-2.5 first:pt-1">
                  <span className="coach-body font-semibold text-[var(--color-main)]">{item.title}</span>
                  <span className="coach-footnote text-[var(--color-secondary)]">{dueLabel(item)}</span>
                  <FollowupStatus
                    status={item.status}
                    response={item.response}
                    shared={item.sharedDecision !== null}
                  />
                </li>
              ))}
            </ul>
          )}
        </FollowupPageState>
      </div>
      <div className="flex flex-col gap-1 border-t border-[var(--color-border)] px-4 py-3">
        <Button type="button" variant="soft" size="sm" fullWidth className="min-h-11" onClick={onCreate}>
          <Plus aria-hidden size={16} strokeWidth={2.25} />
          {t("followup_create")}
        </Button>
        <Button type="button" variant="ghost" size="sm" fullWidth className="min-h-11" onClick={onOpenHistory}>
          {t("followup_history_title")}
        </Button>
      </div>
    </section>
  );
}

/** The panel body: the create/replace form while composing, the full history otherwise. */
export function CoachFollowupsPanel({
  resource,
  studentId,
  compose,
  onCompose,
}: {
  resource: CoachFollowups;
  studentId: string;
  compose: FollowupCompose | null;
  onCompose: (next: FollowupCompose | null) => void;
}) {
  const t = useTranslations("mentorship");

  if (compose) {
    return (
      <FollowupCreateForm
        key={compose.replacesId ?? "new"}
        studentId={studentId}
        replacesId={compose.replacesId}
        onCancel={() => onCompose(null)}
        onSaved={() => {
          // Back to the history, first page, where the record just written is waiting.
          onCompose(null);
          resource.setPage(1);
          resource.reload();
        }}
      />
    );
  }

  return (
    <CoachOverlayBody>
      <div className="flex flex-col gap-5 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`${NOTE_CLASS} max-w-[48ch]`}>{t("followup_history_body")}</p>
        <Button
          type="button"
          variant="soft"
          size="sm"
          className="min-h-11"
          onClick={() => onCompose({ replacesId: null })}
        >
          <Plus aria-hidden size={16} strokeWidth={2.25} />
          {t("followup_create")}
        </Button>
      </div>
      <FollowupPageState loading={resource.loading} error={resource.error} retry={resource.reload}>
        {resource.data?.items.length === 0 ? (
          <p className="coach-body text-[var(--color-secondary)]">{t("followup_history_empty")}</p>
        ) : null}
        <div className="flex flex-col gap-3">
          {resource.data?.items.map((item) => (
            <CoachFollowupItem
              key={`${item.id}:${item.version}`}
              item={item}
              onChanged={resource.reload}
              onError={resource.showError}
              onReplace={() => onCompose({ replacesId: item.id })}
            />
          ))}
        </div>
        {resource.data ? <FollowupPagination {...resource.data} onChange={resource.setPage} /> : null}
      </FollowupPageState>
      </div>
    </CoachOverlayBody>
  );
}
