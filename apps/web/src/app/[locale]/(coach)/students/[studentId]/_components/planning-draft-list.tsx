"use client";
import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { MAX_DRAFTS, type AssignDraft, type PlanningState } from "./planning-state";

export function PlanningDraftList({ drafts, setDrafts, state, setState, today, limit }: {
 drafts: readonly AssignDraft[]; setDrafts: Dispatch<SetStateAction<AssignDraft[]>>;
 state: PlanningState; setState: Dispatch<SetStateAction<PlanningState>>; today: string; limit: string;
}) {
 const t = useTranslations("mentorship");
 return (          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">
              {t("assign_in_program")} ({drafts.length}/{MAX_DRAFTS})
            </h3>
            {[...drafts]
              .sort((a, b) => a.taskDate.localeCompare(b.taskDate))
              .map((draft) => (
                <article
                  key={draft.key}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] py-3"
                >
                  <div>
                    <p>{draft.title}</p>
                    <p className="text-sm">
                      {[
                        draft.taskDate,
                        draft.subject,
                        draft.topic,
                        draft.coachNote,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {(draft.taskDate < today || draft.taskDate > limit) && (
                      <p role="alert">{t("planning_invalid_date")}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
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
                        setDrafts((prev) =>
                          prev.filter((d) => d.key !== draft.key),
                        )
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
