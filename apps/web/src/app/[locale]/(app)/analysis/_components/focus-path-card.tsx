"use client";

import { PencilLine, Play, Plus, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import {
  LEDGE,
  LEDGE_FILLED,
  LEDGE_OUTLINE,
  LEDGE_TEXT_LINK,
  PANEL_HERO,
  PANEL_HERO_TITLE,
} from "@/components/panel/panel-styles";
import { PremiumLockNudge } from "@/components/premium/premium-lock-nudge";
import { Link } from "@/i18n/navigation";
import { trackAnalysisAction } from "@/lib/analytics";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { buildAnalysisCoachHref, formatShortDate } from "./analysis-types";
import {
  buildFocusPath,
  needsFocusDueCount,
  type FocusStepKey,
  type FocusView,
} from "./focus-path-model";
import { EmptyFocusPath, FocusPathSteps } from "./focus-path-steps";
import type { GhostNarration } from "./use-ghost-narration";
import { useReviewDue } from "./use-review-due";

/**
 * "Sıradaki adımın": Gelişim's hero and the view's one primary action (DESIGN.md §6.1 hero).
 * Puhu says how the last exam went, the improvement loop is drawn as a path, and one ledge moves
 * it forward; the AI coach is the only other way out.
 */
export function FocusPathCard({
  analysis,
  examId,
  narration,
  onNewExam,
}: {
  analysis: CoachingAnalysisDto;
  examId: string;
  narration: GhostNarration;
  onNewExam: () => void;
}) {
  const t = useTranslations("analysis.focus_path");
  const cycleFocus = analysis.improvementCycle?.focus ?? null;
  const dueCount = useReviewDue(examId, cycleFocus, needsFocusDueCount(analysis));
  const view = buildFocusPath(analysis, examId, dueCount);
  if (!view) return null;

  const bubble = <HeroBubble analysis={analysis} narration={narration} />;

  if (view.kind === "empty") {
    return (
      <section className={PANEL_HERO} aria-labelledby="analysis-focus-title" data-testid="analysis-improvement-cycle">
        {bubble}
        <div className="flex flex-col gap-1.5">
          <h2 id="analysis-focus-title" className={PANEL_HERO_TITLE}>
            {t("title_empty")}
          </h2>
          <p className="max-w-prose text-body-sm font-semibold text-[var(--color-body)]">
            {t("reason_empty")}
          </p>
        </div>
        <EmptyFocusPath />
        <button type="button" onClick={onNewExam} className={`${LEDGE} ${LEDGE_FILLED} w-full cursor-pointer sm:w-auto sm:self-start`}>
          <Plus className="size-5" strokeWidth={2.5} aria-hidden />
          {t("cta_first_exam")}
        </button>
      </section>
    );
  }

  return (
    <section className={PANEL_HERO} aria-labelledby="analysis-focus-title" data-testid="analysis-improvement-cycle">
      {bubble}
      <FocusBody view={view} onNewExam={onNewExam} />
    </section>
  );
}

function FocusBody({ view, onNewExam }: { view: FocusView; onNewExam: () => void }) {
  const t = useTranslations("analysis.focus_path");
  const tCycle = useTranslations("analysis.improvement_cycle");
  const tFocus = useTranslations("analysis.focus");
  const locale = useLocale();
  const name = view.topicName ?? view.subjectName;
  const newFocus = view.cta.kind === "ADD_TO_PLAN" && view.cta.newFocus;
  const title = newFocus
    ? view.cycleState === "closed"
      ? t("title_closed", { name })
      : t("title_new_focus")
    : view.cta.kind === "ADD_TO_PLAN"
      ? view.source === "PHOTO_SIGNAL"
        ? t("title_signal_notebook", { name })
        : t("title_signal_average", { name })
      : view.cta.kind === "NEW_EXAM"
        ? view.cycleState === "practiced"
          ? t("title_practiced")
          : t("title_measure")
        : t("title_review", { name });
  const planned = view.steps.find((step) => step.key === "planned");
  const meta: Record<FocusStepKey, string | null> = {
    signal:
      view.source === "PHOTO_SIGNAL"
        ? t("meta_signal_notebook", { count: view.evidenceCount })
        : t("meta_signal_average"),
    planned: view.plannedAt
      ? formatShortDate(view.plannedAt, locale)
      : planned?.state === "current"
        ? t("meta_planned_next")
        : null,
    practiced: view.reviewed ? t("meta_reviewed", view.reviewed) : null,
    measured: view.followUpDelta
      ? t("meta_delta", { delta: view.followUpDelta })
      : t("meta_next_exam"),
  };
  const track = (action: "plan" | "notebook" | "coach") =>
    trackAnalysisAction({ action, focusSource: view.source, cycleState: view.cycleState });
  const coachSeed = view.topicName
    ? tFocus("coach_seed", { subject: view.subjectName, topic: view.topicName })
    : tFocus("coach_seed_subject", { subject: view.subjectName });

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <FocusLedge view={view} onNewExam={onNewExam} track={track} />
      {view.coachMockExamId ? (
        <Link
          href={buildAnalysisCoachHref(coachSeed, view.coachMockExamId)}
          onClick={() => track("coach")}
          className={`${LEDGE_TEXT_LINK} gap-1.5 self-end sm:ml-auto sm:self-auto`}
        >
          <Sparkles className="size-4 fill-current text-[var(--premium-ring-from)]" aria-hidden />
          {tCycle("coach")}
        </Link>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {/* Only where it adds something: "Odağın: Matematik" needs no "Matematik" above it. */}
        {view.topicName || !title.includes(view.subjectName) ? (
          <p className="text-caption font-bold text-[var(--color-secondary)]">
            <span>{view.subjectName}</span>
            {view.topicName ? (
              <>
                {" · "}
                <span>{view.topicName}</span>
              </>
            ) : null}
          </p>
        ) : null}
        <h2 id="analysis-focus-title" className={PANEL_HERO_TITLE}>
          {title}
        </h2>
        {view.message ? (
          <p className="max-w-prose text-body-sm font-semibold text-[var(--color-body)]">
            {view.message}
          </p>
        ) : null}
      </div>
      <FocusPathSteps steps={view.steps} meta={meta} />
      {view.proposal ? (
        <div className="flex flex-col gap-3" data-testid="analysis-next-proposal">
          <p className="text-caption font-bold text-[var(--color-secondary)]">
            {t("proposal")}{" "}
            <span className="font-extrabold text-[var(--color-main)]">
              {[view.proposal.subjectName, view.proposal.topicName].filter(Boolean).join(" · ")}
            </span>
          </p>
          {actions}
        </div>
      ) : (
        actions
      )}
    </>
  );
}

function FocusLedge({
  view,
  onNewExam,
  track,
}: {
  view: FocusView;
  onNewExam: () => void;
  track: (action: "plan" | "notebook") => void;
}) {
  const t = useTranslations("analysis.focus_path");
  const tCycle = useTranslations("analysis.improvement_cycle");
  const filled = `${LEDGE} ${LEDGE_FILLED} w-full sm:w-auto`;
  const { cta } = view;

  if (cta.kind === "ADD_TO_PLAN") {
    return (
      <Link href={{ pathname: "/plan", query: cta.query }} onClick={() => track("plan")} className={filled}>
        <Plus className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
        {cta.newFocus ? tCycle("add_new_focus") : tCycle("add_to_plan")}
      </Link>
    );
  }
  if (cta.kind === "REVIEW") {
    return (
      <Link href={{ pathname: "/notebook", query: cta.query }} onClick={() => track("notebook")} className={filled}>
        <Play className="size-[18px] shrink-0 fill-current" aria-hidden />
        {cta.count != null ? t("cta_review_count", { count: cta.count }) : t("cta_review")}
      </Link>
    );
  }
  if (cta.kind === "OPEN_NOTEBOOK") {
    return (
      <Link
        href={{ pathname: "/notebook", query: cta.query }}
        onClick={() => track("notebook")}
        className={`${LEDGE} ${LEDGE_OUTLINE} w-full sm:w-auto`}
      >
        {tCycle("review")}
      </Link>
    );
  }
  // A new exam keeps the student on this page: the form opens in place.
  return (
    <button type="button" onClick={onNewExam} className={`${filled} cursor-pointer`}>
      <PencilLine className="size-5 shrink-0" strokeWidth={2.4} aria-hidden />
      {t("cta_new_exam")}
    </button>
  );
}

/**
 * Puhu's line. Before any exam and after the first one it is fixed copy; from the second exam on it
 * is the server's rule-based comparison, or for a premium student the coach's narration (labelled).
 */
function HeroBubble({
  analysis,
  narration,
}: {
  analysis: CoachingAnalysisDto;
  narration: GhostNarration;
}) {
  const t = useTranslations("analysis.focus_path");
  const tGhost = useTranslations("ghost");
  const { openPaywall } = usePremiumPaywall();
  const ghost = analysis.ghost;

  if (analysis.trend.length === 0) {
    return <CompanionBubble puhu="encouraging" text={t("bubble_empty")} />;
  }
  if (!ghost) return <CompanionBubble puhu="default" text={t("bubble_first")} />;
  if (narration.text) {
    return <CompanionBubble puhu="winking" text={narration.text} aiLabel={t("ai_label")} />;
  }
  if (narration.pending) {
    return (
      <CompanionBubble puhu="winking" text={tGhost("narrating")} aiLabel={t("ai_label")} busy />
    );
  }
  return (
    <CompanionBubble puhu={ghost.beatPrevious ? "winking" : "encouraging"} text={ghost.headline}>
      {narration.locked ? (
        <PremiumLockNudge
          label={tGhost("premium_nudge")}
          onClick={() => openPaywall({ sourceFeature: "ghost.narration" })}
        />
      ) : null}
    </CompanionBubble>
  );
}
