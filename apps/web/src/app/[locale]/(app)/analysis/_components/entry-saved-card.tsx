"use client";

import { ArrowDownRight, ArrowUpRight, ChevronRight, NotebookPen, Star } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import {
  LEDGE,
  LEDGE_FILLED,
  LEDGE_TEXT_LINK,
  PANEL_HERO,
} from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { formatTrendDate } from "./analysis-types";
import type { GhostNarration } from "./use-ghost-narration";
import type { SavedMockExam } from "./use-mock-exam-entry";

const HAIRLINE = "border-t border-[color-mix(in_srgb,var(--color-main)_7%,transparent)]";
const UP = "text-[var(--color-success)]";
/** Downward is grey, never red (DESIGN.md §2.4). */
const FLAT_OR_DOWN = "text-[var(--color-secondary)]";

/**
 * The moment after a save, in place of the toast and the handoff banner: Puhu says it is in, the net
 * against the exam before, what moved per subject, and one way on. An exam dated before the latest
 * joins the history without a comparison; the coach's narration only ever reads the latest.
 */
export function EntrySavedCard({
  saved,
  analysis,
  narration,
  onProgress,
  onNewExam,
}: {
  saved: SavedMockExam;
  /** Already refreshed with this exam in it (or stale, if the refresh failed). */
  analysis: CoachingAnalysisDto | null;
  narration: GhostNarration;
  onProgress: () => void;
  onNewExam: () => void;
}) {
  const t = useTranslations("analysis.saved");
  const tAnalysis = useTranslations("analysis");
  const tNet = useTranslations("analysis.net_card");
  const tFocus = useTranslations("analysis.focus_path");
  const tGhost = useTranslations("ghost");
  const locale = useLocale();
  const ref = useRef<HTMLElement>(null);

  // The form this replaces held the focus; hand it to the moment so it is read out and in view.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const known = analysis?.trend.some((point) => point.id === saved.id) ?? false;
  const latest = known && analysis?.trend[0]?.id === saved.id;
  const ghost = latest && analysis?.ghost?.latest.id === saved.id ? analysis.ghost : null;
  const delta = ghost ? Number(ghost.previousDelta) : 0;
  const hasWrong = saved.wrongTotal > 0;

  const bubble = !known ? (
    <CompanionBubble puhu="happy" text={t("bubble_saved")} />
  ) : !latest ? (
    <CompanionBubble puhu="default" text={t("bubble_past")} />
  ) : !ghost ? (
    <CompanionBubble puhu="happy" text={tFocus("bubble_first")} />
  ) : narration.text ? (
    <CompanionBubble puhu="winking" text={narration.text} aiLabel={tFocus("ai_label")} />
  ) : narration.pending ? (
    <CompanionBubble puhu="winking" text={tGhost("narrating")} aiLabel={tFocus("ai_label")} busy />
  ) : (
    <CompanionBubble
      puhu={ghost.isNewRecord ? "proud" : ghost.beatPrevious ? "happy" : "encouraging"}
      text={t("bubble_latest", { headline: ghost.headline })}
    />
  );

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby="analysis-saved-title"
      data-testid="analysis-saved"
      className={`${PANEL_HERO} outline-none`}
    >
      {bubble}

      <div className="flex flex-col gap-1">
        <h2 id="analysis-saved-title" className="text-sm font-extrabold text-[var(--color-secondary)]">
          {t("title", {
            publisher: saved.publisherName ?? tAnalysis("history.publisher_fallback"),
            date: formatTrendDate(saved.takenAt, locale),
          })}
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span
            data-testid="analysis-saved-net"
            className="text-display font-black leading-none tabular-nums text-[var(--color-main)]"
          >
            {saved.totalNet}
          </span>
          <span className="text-body-sm font-extrabold text-[var(--color-secondary)]">
            {tNet("unit")}
          </span>
          {ghost ? (
            <>
              <span
                className={`inline-flex items-center gap-0.5 text-body-sm font-extrabold tabular-nums ${delta > 0 ? UP : FLAT_OR_DOWN}`}
              >
                {delta > 0 ? (
                  <ArrowUpRight className="size-4" strokeWidth={2.6} aria-hidden />
                ) : delta < 0 ? (
                  <ArrowDownRight className="size-4" strokeWidth={2.6} aria-hidden />
                ) : null}
                {ghost.previousDelta}
              </span>
              <span className="text-caption text-[var(--color-secondary)]">
                {tNet("delta_caption")}
              </span>
              {ghost.isNewRecord ? (
                <span className="inline-flex items-center gap-1 self-center rounded-full bg-[color-mix(in_srgb,var(--color-streak-core)_30%,var(--color-surface))] px-2.5 py-1 text-xs font-extrabold text-[var(--color-main)]">
                  <Star className="size-3.5 fill-current text-[var(--color-star)]" aria-hidden />
                  {tNet("new_record")}
                </span>
              ) : analysis?.personalRecordNet ? (
                <span className="text-caption font-bold text-[var(--color-secondary)]">
                  {tNet.rich("record", {
                    value: analysis.personalRecordNet,
                    b: (chunks) => (
                      <strong className="font-extrabold tabular-nums text-[var(--color-main)]">
                        {chunks}
                      </strong>
                    ),
                  })}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {ghost && ghost.subjects.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-extrabold text-[var(--color-main)]">{t("subjects_title")}</h3>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {ghost.subjects.map((subject) => {
              const moved = subject.delta != null ? Number(subject.delta) : 0;
              return (
                <li key={subject.subjectRef} className={`flex min-h-10 items-center gap-2 ${HAIRLINE}`}>
                  <span className="min-w-0 flex-1 text-sm font-extrabold text-[var(--color-main)]">
                    {subject.subjectName}
                  </span>
                  <span className="text-sm font-extrabold tabular-nums text-[var(--color-main)]">
                    {subject.latestNet}
                  </span>
                  <span
                    className={`min-w-14 text-right text-caption font-extrabold tabular-nums ${moved > 0 ? UP : FLAT_OR_DOWN}`}
                  >
                    {subject.delta ?? ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {hasWrong ? (
          <p className="text-body-sm font-semibold text-[var(--color-body)]">
            {tAnalysis("notebook_handoff", { count: saved.wrongTotal })}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          {hasWrong ? (
            // A count and a door, never cards made for them: the student picks which mistakes to file.
            <Link
              href={{ pathname: "/notebook", query: { mockExam: saved.id } }}
              className={`${LEDGE} ${LEDGE_FILLED} w-full sm:w-auto`}
            >
              <NotebookPen className="size-5 shrink-0" strokeWidth={2.4} aria-hidden />
              {t("cta_notebook")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onProgress}
              className={`${LEDGE} ${LEDGE_FILLED} w-full cursor-pointer sm:w-auto`}
            >
              {t("cta_progress")}
            </button>
          )}
          <div className="flex items-center gap-4 self-end sm:ml-auto sm:self-auto">
            {hasWrong ? (
              <button type="button" onClick={onProgress} className={`${LEDGE_TEXT_LINK} cursor-pointer gap-1`}>
                {t("cta_progress")}
                <ChevronRight className="size-4" aria-hidden />
              </button>
            ) : null}
            <button type="button" onClick={onNewExam} className={`${LEDGE_TEXT_LINK} cursor-pointer`}>
              {tFocus("cta_new_exam")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
