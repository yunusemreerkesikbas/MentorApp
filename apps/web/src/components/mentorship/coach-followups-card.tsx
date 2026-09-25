"use client";

import { useCallback } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import type { MentorshipFollowupDto } from "@mentor/types";
import { fetchMentorshipFollowups } from "@/lib/mentorship-followups";
import { CoachOverlayBody, CoachOverlayFooter } from "@/components/coach-overlay";
import { NOTE_CLASS } from "./coach-ui";
import { CoachFollowupItem } from "./coach-followup-item";
import { FollowupCreateForm } from "./followup-create-form";
import { FollowupPageState, FollowupPagination } from "./followup-page-state";
import { useFollowupPage } from "./use-followup-page";

const PAGE_SIZE = 10;

export type FollowupCompose = { replacesId: string | null };

/**
 * One read of this student's follow-ups, shared by the report's rail card and the panel history:
 * the two can never disagree, and opening the panel costs no second request.
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
    <>
      <CoachOverlayBody>
        <div className="flex flex-col gap-5 pb-4">
          <p className={`${NOTE_CLASS} max-w-[56ch]`}>{t("followup_history_body")}</p>
          <FollowupPageState loading={resource.loading} error={resource.error} retry={resource.reload}>
            {resource.data?.items.length === 0 ? (
              <p className="text-body-sm font-semibold text-[var(--color-secondary)]">
                {t("followup_history_empty")}
              </p>
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
      {/* The panel's one filled button, at its foot like the planner's send. */}
      <CoachOverlayFooter>
        <Button type="button" className="min-h-11" onClick={() => onCompose({ replacesId: null })}>
          <Plus aria-hidden size={16} strokeWidth={2.25} />
          {t("followup_create")}
        </Button>
      </CoachOverlayFooter>
    </>
  );
}
