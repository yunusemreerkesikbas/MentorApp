"use client";
import { useId, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { PANEL_LINK_BUTTON, PANEL_QUIET_BUTTON } from "@/components/mentorship/coach-ui";
import { MAX_DRAFTS, type AssignDraft } from "./planning-state";
import { PLANNER_SUBHEAD } from "./planning-week";
import { useReportDates } from "./use-report-dates";

/**
 * "Bu programda": the week being composed, one row per draft ("Per 24 · Paragraf: 25 soru") with
 * its two text actions. Drawn only once there is a draft; `footer` holds what acts on the whole
 * program (saving it as a template).
 */
export function PlanningDraftList({
  drafts,
  setDrafts,
  editingKey,
  editLocked,
  onEdit,
  today,
  limit,
  footer,
}: {
  drafts: readonly AssignDraft[];
  setDrafts: Dispatch<SetStateAction<AssignDraft[]>>;
  /** The draft the composer is editing, if any. */
  editingKey: string | null;
  /** The composer holds unsaved input: opening another draft would drop it. */
  editLocked: boolean;
  onEdit: (draft: AssignDraft) => void;
  today: string;
  limit: string;
  footer?: ReactNode;
}) {
  const t = useTranslations("mentorship");
  const dates = useReportDates();
  const headingId = useId();
  if (drafts.length === 0) return null;

  return (
    <section className="flex flex-col" aria-labelledby={headingId}>
      <h3 id={headingId} className={PLANNER_SUBHEAD}>
        {t("assign_in_program")} · {drafts.length}/{MAX_DRAFTS}
      </h3>
      <ul className="flex flex-col">
        {[...drafts]
          .sort((a, b) => a.taskDate.localeCompare(b.taskDate))
          .map((draft) => {
            const meta = [
              draft.subject ? [draft.subject, draft.topic].filter(Boolean).join(" › ") : null,
              draft.coachNote,
            ]
              .filter(Boolean)
              .join(" · ");
            const editing = editingKey === draft.key;
            return (
              <li
                key={draft.key}
                className="flex flex-wrap items-center justify-between gap-x-4 border-t border-[var(--play-line)] py-1 first:border-t-0"
              >
                <div className="min-w-0 flex-1 py-1.5">
                  <p className="text-body-sm font-extrabold text-[var(--color-main)]">
                    {dates.shortDay(draft.taskDate)} · {draft.title}
                  </p>
                  {meta ? (
                    <p className="truncate text-caption font-semibold text-[var(--color-secondary)]">{meta}</p>
                  ) : null}
                  {draft.taskDate < today || draft.taskDate > limit ? (
                    <p role="alert" className="text-caption font-semibold text-[var(--color-danger)]">
                      {t("planning_invalid_date")}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <button
                    type="button"
                    className={PANEL_LINK_BUTTON}
                    aria-label={t("planning_edit_named", { title: draft.title })}
                    disabled={editing || editLocked}
                    onClick={() => onEdit(draft)}
                  >
                    {t("planning_edit")}
                  </button>
                  <button
                    type="button"
                    className={PANEL_QUIET_BUTTON}
                    aria-label={t("planning_remove_named", { title: draft.title })}
                    disabled={editing}
                    onClick={() => setDrafts((prev) => prev.filter((d) => d.key !== draft.key))}
                  >
                    {t("assign_remove")}
                  </button>
                </div>
              </li>
            );
          })}
      </ul>
      {footer}
    </section>
  );
}
