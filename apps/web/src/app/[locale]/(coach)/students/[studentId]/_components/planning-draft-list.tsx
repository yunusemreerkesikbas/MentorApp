"use client";
import { useId, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { PANEL_LINK_BUTTON, PANEL_QUIET_BUTTON } from "@/components/mentorship/coach-ui";
import { COACH_EASE } from "@/components/mentorship/coach-motion";
import { CountPop } from "../../../_components/count-pop";
import { MAX_DRAFTS, type AssignDraft } from "./planning-state";
import { PLANNER_SUBHEAD } from "./planning-week";
import { useReportDates } from "./use-report-dates";

/**
 * The drafts that arrived in the latest change, in list order: a batch (the assistant's
 * suggestions, a template) steps in 40 ms apart, and each newcomer's tint fades. Kept from the
 * previous render the way React documents it; drafts already there when the panel opened are not
 * newcomers.
 */
function useArrivals(keys: readonly string[]): readonly string[] {
  const signature = keys.join(",");
  const [seen, setSeen] = useState(() => ({ signature, known: new Set(keys), arrived: [] as string[] }));
  if (seen.signature !== signature) {
    setSeen({ signature, known: new Set(keys), arrived: keys.filter((key) => !seen.known.has(key)) });
  }
  return seen.arrived;
}

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
  const sorted = [...drafts].sort((a, b) => a.taskDate.localeCompare(b.taskDate));
  const arrived = useArrivals(sorted.map((draft) => draft.key));
  if (drafts.length === 0) return null;

  return (
    <section className="flex flex-col" aria-labelledby={headingId}>
      <h3
        id={headingId}
        className={PLANNER_SUBHEAD}
        aria-label={`${t("assign_in_program")} · ${drafts.length}/${MAX_DRAFTS}`}
      >
        {t("assign_in_program")} · <CountPop value={drafts.length} />/{MAX_DRAFTS}
      </h3>
      {/* `popLayout`: a removed row leaves the flow at once and fades; the rows below slide up. */}
      <ul className="relative flex flex-col">
        <AnimatePresence initial={false} mode="popLayout">
          {sorted.map((draft) => {
            const meta = [
              draft.subject ? [draft.subject, draft.topic].filter(Boolean).join(" › ") : null,
              draft.coachNote,
            ]
              .filter(Boolean)
              .join(" · ");
            const editing = editingKey === draft.key;
            const arrival = arrived.indexOf(draft.key);
            return (
              <motion.li
                key={draft.key}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.25, ease: COACH_EASE, delay: Math.min(Math.max(arrival, 0), 7) * 0.04 }}
                className={`flex flex-wrap items-center justify-between gap-x-4 border-t border-[var(--play-line)] py-1 first:border-t-0 ${arrival >= 0 ? "coach-flash" : ""}`}
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
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {footer}
    </section>
  );
}
