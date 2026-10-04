"use client";

import {
  BookOpen,
  ChevronRight,
  Crosshair,
  Eye,
  Play,
  ScanText,
  Shuffle,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { CoachingAnalysisDto, NotebookErrorType } from "@mentor/types";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import {
  LEDGE,
  LEDGE_FILLED,
  LEDGE_TEXT_LINK,
  PANEL_HERO,
  PANEL_HERO_TITLE,
} from "@/components/panel/panel-styles";
import { ProgressLine } from "@/components/panel/progress-line";
import { Link } from "@/i18n/navigation";
import { useReviewDue } from "./use-review-due";

/** Icon wells by what the mistake is about (DESIGN.md §6.1 icon well). */
const ERROR_WELL: Record<NotebookErrorType, [LucideIcon, string]> = {
  UNKNOWN_TOPIC: [BookOpen, "bg-[var(--play-well-violet)] text-[var(--color-chip-text)]"],
  CARELESS: [Eye, "bg-[var(--play-well-blue)] text-[var(--play-selected-ink)]"],
  MISREAD: [ScanText, "bg-[var(--play-well-blue)] text-[var(--play-selected-ink)]"],
  DISTRACTOR: [Crosshair, "bg-[var(--play-well-peri)] text-[var(--play-selected-ink)]"],
  CHANGED_ANSWER: [Shuffle, "bg-[var(--play-well-peri)] text-[var(--play-selected-ink)]"],
  TIME: [Timer, "bg-[var(--play-well-coral)] text-[var(--color-streak)]"],
};

const ROW =
  "flex min-h-14 items-center gap-3 border-t border-[color-mix(in_srgb,var(--color-main)_7%,transparent)] py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/**
 * "Neden kaçırıyorsun?": Yanlışlarım's hero. The one thing the student cannot work out alone is not
 * where the points went but why; each reason opens its own questions, and the ledge starts the
 * review of everything due in this exam.
 */
export function MistakesWhyCard({
  analysis,
  examId,
}: {
  analysis: CoachingAnalysisDto;
  examId: string;
}) {
  const t = useTranslations("analysis.mistakes");
  const tAnalysis = useTranslations("analysis");
  const tNotebook = useTranslations("notebook");
  const hasEntries = analysis.notebookStats.savedCount > 0;
  const due = useReviewDue(examId, null, hasEntries);
  const signals = analysis.notebookErrorSignals;

  return (
    <section className={PANEL_HERO} aria-labelledby="analysis-why-title">
      <CompanionBubble
        puhu="encouraging"
        text={
          signals.length > 0
            ? (analysis.notebookErrorMessage ?? t("why_bubble"))
            : t("why_bubble_empty")
        }
      />
      <div className="flex flex-col gap-1.5">
        <h2 id="analysis-why-title" className={PANEL_HERO_TITLE}>
          {t("why_title")}
        </h2>
        <p className="text-caption font-semibold text-[var(--color-secondary)]">
          {signals.length > 0
            ? t("why_caption", { days: analysis.notebookStats.windowDays })
            : t("why_caption_empty")}
        </p>
      </div>

      {signals.length > 0 ? (
        <ul className="flex flex-col">
          {signals.map((signal) => {
            const [Icon, well] = ERROR_WELL[signal.errorType];
            const label = tNotebook(`error_type.${signal.errorType}`);
            return (
              <li key={signal.errorType}>
                <Link
                  href={{
                    pathname: "/notebook",
                    query: { review: "focus", examId, errorType: signal.errorType },
                  }}
                  className={ROW}
                >
                  <span
                    aria-hidden
                    className={`grid size-10 shrink-0 place-items-center rounded-[var(--radius-card)] ${well}`}
                  >
                    <Icon className="size-5" strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 text-sm font-extrabold leading-snug text-[var(--color-main)]">
                        {label}
                      </span>
                      <span className="shrink-0 text-caption font-extrabold tabular-nums text-[var(--color-secondary)]">
                        {tAnalysis("signal_share", {
                          count: signal.count,
                          percent: signal.sharePercent,
                        })}
                      </span>
                    </span>
                    <span aria-hidden className="mt-1.5 block">
                      <ProgressLine label={label} value={signal.sharePercent} max={100} />
                    </span>
                  </span>
                  <ChevronRight
                    className="size-[18px] shrink-0 text-[var(--color-secondary)]"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {hasEntries && due !== 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href={{ pathname: "/notebook", query: { review: "focus", examId } }}
            className={`${LEDGE} ${LEDGE_FILLED} w-full sm:w-auto`}
          >
            <Play className="size-[18px] shrink-0 fill-current" aria-hidden />
            {due != null ? t("cta_review_count", { count: due }) : t("cta_review")}
          </Link>
          <Link
            href="/notebook"
            className={`${LEDGE_TEXT_LINK} gap-1 self-end sm:ml-auto sm:self-auto`}
          >
            {t("open_notebook")}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <Link href="/notebook" className={`${LEDGE} ${LEDGE_FILLED} w-full sm:w-auto sm:self-start`}>
          {t("open_notebook")}
        </Link>
      )}
    </section>
  );
}
