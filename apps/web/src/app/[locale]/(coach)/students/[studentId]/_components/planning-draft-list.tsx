"use client";
import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import {
  MAX_DRAFTS,
  type AssignDraft,
  type PlanningState,
} from "./planning-state";
import { PLANNER_SUBHEAD } from "./planning-week";
import { useReportDates } from "./use-report-dates";

export function PlanningDraftList({
  drafts,
  setDrafts,
  state,
  setState,
  today,
  limit,
}: {
  drafts: readonly AssignDraft[];
  setDrafts: Dispatch<SetStateAction<AssignDraft[]>>;
  state: PlanningState;
  setState: Dispatch<SetStateAction<PlanningState>>;
  today: string;
  limit: string;
}) {
  const t = useTranslations("mentorship");
  const dates = useReportDates();
  return (
    <section className="flex flex-col">
      <h3 className={PLANNER_SUBHEAD}>
        {t("assign_in_program")} ({drafts.length}/{MAX_DRAFTS})
      </h3>
      {[...drafts]
        .sort((a, b) => a.taskDate.localeCompare(b.taskDate))
        .map((draft) => (
          <article
            key={draft.key}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--play-line)] py-2.5"
          >
            <div className="min-w-0">
              <p className="text-body-sm font-extrabold text-[var(--color-main)]">{draft.title}</p>
              <p className="text-caption font-semibold text-[var(--color-secondary)]">
                {[dates.shortDay(draft.taskDate), draft.subject, draft.topic, draft.coachNote]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {(draft.taskDate < today || draft.taskDate > limit) && (
                <p role="alert" className="text-caption font-semibold text-[var(--color-danger)]">
                  {t("planning_invalid_date")}
                </p>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!!state.editor}
                onClick={() =>
                  setState((s) => ({ ...s, editor: { ...draft } }))
                }
              >
                {t("planning_edit")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={state.editor?.key === draft.key}
                onClick={() =>
                  setDrafts((prev) => prev.filter((d) => d.key !== draft.key))
                }
              >
                {t("assign_remove")}
              </Button>
            </div>
          </article>
        ))}
    </section>
  );
}
