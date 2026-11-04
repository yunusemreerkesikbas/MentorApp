"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowRight, Calendar, Check, ChevronRight, Plus } from "lucide-react";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { ApiClientError } from "@mentor/api-client";
import type { WeeklyRecapReportDto, WeeklyReportFollowUpDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { fetchWeeklyReportFollowUp } from "@/lib/weekly-report-follow-up";
import { parseNet } from "@/lib/weekly-deep-analysis";
import { LEDGE, LEDGE_FILLED, PANEL_CARD, PANEL_CARD_TITLE, PANEL_HERO, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { DeltaChip, EYEBROW, SUCCESS_CHIP, signed } from "./weekly-deep-analysis-parts";

export type FollowUpState = { kind: "loading" } | { kind: "ready"; data: WeeklyReportFollowUpDto } | { kind: "error"; message: string };

/** Live task status for the report's step and last week's step; refreshes when the tab returns. */
export function useWeeklyReportFollowUp(reportId: string) {
  const t = useTranslations("analysis.report.follow_up");
  const [state, setState] = useState<FollowUpState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchWeeklyReportFollowUp(reportId);
        if (active) setState({ kind: "ready", data });
      } catch (error) {
        if (active) setState({ kind: "error", message: error instanceof ApiClientError ? error.message : t("error") });
      }
    };
    void load();
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; document.removeEventListener("visibilitychange", visible); };
  }, [reportId, attempt, t]);
  return { state, retry: () => setAttempt((n) => n + 1) };
}

function PlanLink({ date, children }: { date: string; children: ReactNode }) {
  return <Link href={{ pathname: "/plan", query: { date } }} className={`${PANEL_TEXT_LINK} self-start`}>
    {children}<ChevronRight className="size-4" aria-hidden />
  </Link>;
}

/** The screen's one ledge: the report's suggested step, or where that step now sits in the plan. */
export function WeeklyNextStep({ report, state, onRetry }: { report: WeeklyRecapReportDto; state: FollowUpState; onRetry: () => void }) {
  const t = useTranslations("analysis.report.follow_up");
  const format = useFormatter();
  const suggestion = report.review.suggestedTask;
  const task = state.kind === "ready" ? state.data.task : null;
  const title = task?.title ?? suggestion?.title;
  return <section className={PANEL_HERO} aria-labelledby="deep-next-title" data-testid="weekly-report-follow-up">
    <p className={EYEBROW}>{t("title")}</p>
    {state.kind === "loading" ? <SkeletonGroup label={t("loading")} className="space-y-3">
      <Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-14 w-56" />
    </SkeletonGroup> : state.kind === "error" ? <div role="alert" className="space-y-3">
      <p className="text-sm text-[var(--color-main)]">{state.message}</p>
      <Button variant="secondary" onClick={onRetry}>{t("retry")}</Button>
    </div> : !title ? <p id="deep-next-title" className="text-sm text-[var(--color-secondary)]">{t("no_task")}</p> : <>
      <div className="space-y-2">
        <h2 id="deep-next-title" className="text-xl font-extrabold leading-snug text-[var(--color-main)] sm:text-title">{title}</h2>
        {report.review.focus ? <p className="max-w-prose text-pretty text-body-sm leading-relaxed text-[var(--color-body)]">{report.review.focus.message}</p> : null}
      </div>
      {task ? <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {task.status === "DONE"
          ? <span className={SUCCESS_CHIP}><Check className="size-3.5" strokeWidth={3} aria-hidden />{t("done")}</span>
          : <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--play-selected)] px-3 text-sm font-extrabold text-[var(--play-selected-ink)]">
            <Calendar className="size-3.5" aria-hidden />
            {t("planned", { date: format.dateTime(new Date(`${task.taskDate}T00:00:00Z`), { day: "numeric", month: "long", timeZone: "UTC" }) })}
          </span>}
        <PlanLink date={task.taskDate}>{t("go_plan")}</PlanLink>
      </div> : suggestion ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <Link href={{ pathname: "/plan", query: { add: "1", source: "weekly-report", weeklyReportId: report.id,
          title: suggestion.title, ...(suggestion.subject ? { subject: suggestion.subject } : {}) } }} className={`${LEDGE} ${LEDGE_FILLED} w-full sm:w-auto`}>
          <Plus className="size-5" strokeWidth={2.5} aria-hidden />{t("add")}
        </Link>
        <p className="text-caption text-[var(--color-secondary)]">{t("add_hint")}</p>
      </div> : null}
    </>}
  </section>;
}

/** Last week's step: its live status and the net before and after it. Hidden until loaded. */
export function WeeklyPreviousStep({ state }: { state: FollowUpState }) {
  const t = useTranslations("analysis.report.follow_up");
  const tr = useTranslations("analysis.report");
  const format = useFormatter();
  const previous = state.kind === "ready" ? state.data.previous : null;
  if (!previous) return null;
  const net = (value: string | null) => {
    const n = parseNet(value);
    return n === null ? null : tr("net", { net: format.number(n, { maximumFractionDigits: 2 }) });
  };
  const baseline = net(previous.baselineNet);
  const measured = previous.measurement ? net(previous.measurement.net) : null;
  const delta = previous.measurement ? parseNet(previous.measurement.delta) : null;
  return <section className={`${PANEL_CARD} flex flex-col gap-3`} aria-labelledby="deep-previous-title" data-testid="weekly-report-previous-step">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="deep-previous-title" className={PANEL_CARD_TITLE}>{t("previous")}</h2>
      {previous.task.status === "DONE" ? <span className={SUCCESS_CHIP}><Check className="size-3.5" strokeWidth={3} aria-hidden />{t("done")}</span> : null}
    </div>
    <p className="font-extrabold text-[var(--color-main)]">{previous.task.title}</p>
    {baseline ? <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-[var(--play-track)] px-4 py-3">
      <div className="flex flex-col gap-1">
        <span className="text-caption text-[var(--color-secondary)]">{t("baseline_label")}</span>
        <span className="text-xl font-black tabular-nums text-[var(--color-secondary)]">{baseline}</span>
      </div>
      <ArrowRight className="size-5 shrink-0 text-[var(--color-secondary)]" aria-hidden />
      <div className="flex flex-col gap-1">
        <span className="text-caption text-[var(--color-secondary)]">{t("measurement_label")}</span>
        <span className={`tabular-nums ${measured ? "text-xl font-black text-[var(--color-main)]" : "text-sm font-bold text-[var(--color-secondary)]"}`}>
          {measured ?? t("measurement_pending")}
        </span>
      </div>
      {delta !== null && delta !== 0 ? <DeltaChip delta={delta} className="ml-auto">
        {signed(delta, format.number(Math.abs(delta), { maximumFractionDigits: 2 }))}
      </DeltaChip> : null}
    </div> : null}
    <p className="text-caption leading-relaxed text-[var(--color-secondary)]">{previous.message}</p>
    <PlanLink date={previous.task.taskDate}>{t("go_plan")}</PlanLink>
  </section>;
}
