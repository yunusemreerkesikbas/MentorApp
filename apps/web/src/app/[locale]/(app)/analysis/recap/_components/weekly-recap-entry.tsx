"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AuthUser, ExamCalendarDto, Paginated, WeeklyRecapArchiveItemDto, WeeklyRecapOfferDto, WeeklyRecapReportDto } from "@mentor/types";
import { ApiClientError, usersControllerMe, contentControllerCalendarByFamily } from "@mentor/api-client";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { notifyEconomyChanged } from "@/lib/economy";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { fetchOwnedWeeklyRecap, fetchWeeklyRecapArchive, fetchWeeklyRecapOffer, openWeeklyRecap } from "@/lib/weekly-recap-access-api";
import { WeeklyRecapShell } from "./weekly-recap-shell";
import { WeeklyRecapAccessCard } from "./weekly-recap-access-card";
import { WeeklyRecapArchive } from "./weekly-recap-archive";

type State = { kind: "loading" } | { kind: "legacy" } | { kind: "error"; message: string }
  | { kind: "offer"; offer: WeeklyRecapOfferDto } | { kind: "report"; report: WeeklyRecapReportDto };

export function WeeklyRecapEntry() {
  const t = useTranslations("analysis.recap");
  const search = useSearchParams();
  const requestedExam = search.get("examId");
  const reportId = search.get("reportId");
  const { openPaywall } = usePremiumPaywall();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [archive, setArchive] = useState<Paginated<WeeklyRecapArchiveItemDto> | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const message = useCallback((error: unknown) => error instanceof ApiClientError ? error.message : t("load_error"), [t]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (reportId) {
          const report = await fetchOwnedWeeklyRecap(reportId);
          if (!cancelled) setState({ kind: "report", report });
          return;
        }
        let examId = requestedExam;
        if (!examId) {
          const me = await usersControllerMe() as unknown as AuthUser;
          if (!me.examType) { if (!cancelled) setState({ kind: "legacy" }); return; }
          const calendar = await contentControllerCalendarByFamily(me.examType) as unknown as ExamCalendarDto | null;
          examId = calendar?.exam?.id ?? null;
        }
        if (!examId) { if (!cancelled) setState({ kind: "legacy" }); return; }
        const [offer, saved] = await Promise.all([fetchWeeklyRecapOffer(examId), fetchWeeklyRecapArchive()]);
        if (!cancelled) { setArchive(saved); setState(offer.enabled ? { kind: "offer", offer } : { kind: "legacy" }); }
      } catch (error) { if (!cancelled) setState({ kind: "error", message: message(error) }); }
    }
    void load();
    return () => { cancelled = true; };
  }, [requestedExam, reportId, attempt, message]);

  // Coin earned in another tab or a membership just bought: the offer catches up when the tab returns.
  const shown = state.kind === "offer" ? state.offer : null;
  const examId = shown?.examId, weekStart = shown?.weekStart;
  useEffect(() => {
    if (!examId || !weekStart || busy) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // ponytail: a failed background refetch keeps the shown offer; opening re-quotes on the server anyway.
      fetchWeeklyRecapOffer(examId, weekStart)
        .then((offer) => setState((now) => now.kind === "offer" ? { kind: "offer", offer } : now))
        .catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [examId, weekStart, busy]);

  const read = async (id: string) => {
    setBusy(true); setError(null);
    try { setState({ kind: "report", report: await fetchOwnedWeeklyRecap(id) }); }
    catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  };
  const open = async () => {
    if (state.kind !== "offer" || busy) return;
    const { offer } = state;
    if (offer.reportId) { await read(offer.reportId); return; }
    if (offer.mode === "COIN" && !armed) { setArmed(true); return; }
    if (offer.mode === "NONE") return;
    setBusy(true); setError(null);
    try {
      const report = await openWeeklyRecap({ examId: offer.examId, weekStart: offer.weekStart, source: offer.mode,
        expectedCost: offer.cost, clientRequestId: crypto.randomUUID() });
      notifyEconomyChanged(); setState({ kind: "report", report });
    } catch (error) {
      setError(message(error));
      try { setState({ kind: "offer", offer: await fetchWeeklyRecapOffer(offer.examId, offer.weekStart) }); }
      catch (refreshError) { setState({ kind: "error", message: message(refreshError) }); }
    } finally { setBusy(false); setArmed(false); }
  };
  const page = async (page: number) => {
    setBusy(true);
    try { setArchive(await fetchWeeklyRecapArchive(page)); } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  };
  const readArchived = async (item: WeeklyRecapArchiveItemDto) => {
    if (!item.requiresOpening) { await read(item.id); return; }
    setBusy(true); setError(null); setArmed(false);
    try { setState({ kind: "offer", offer: await fetchWeeklyRecapOffer(item.examId, item.weekStart) }); }
    catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  };
  const reload = async () => {
    if (state.kind !== "offer") return;
    setBusy(true); setError(null); setArmed(false);
    try { setState({ kind: "offer", offer: await fetchWeeklyRecapOffer(state.offer.examId, state.offer.weekStart) }); }
    catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  };
  if (state.kind === "legacy") return <WeeklyRecapShell />;
  if (state.kind === "report") return <WeeklyRecapShell savedReport={state.report} />;
  return <main className="mx-auto w-full max-w-xl px-4 py-8" data-testid="weekly-recap-access">
    {state.kind === "loading" ? <SkeletonGroup label={t("loading")} className="space-y-4"><Skeleton className="h-[540px] w-full" /><Skeleton className="h-32 w-full" /></SkeletonGroup>
      : state.kind === "error" ? <section role="alert" className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6">
        <p>{state.message}</p><Button className="mt-4" onClick={() => setAttempt((value) => value + 1)}>{t("ownership.retry")}</Button>
        <Link href="/analysis" className="mt-4 flex min-h-11 items-center underline">{t("ownership.statistics")}</Link>
      </section> : <WeeklyRecapAccessCard offer={state.offer} busy={busy} armed={armed} error={error} onOpen={() => void open()}
        onRetry={() => void reload()} onCancel={() => setArmed(false)}
        onPremium={() => openPaywall({ sourceFeature: "weekly.narration" })} />}
    {archive ? <WeeklyRecapArchive archive={archive} busy={busy} onRead={(item) => void readArchived(item)} onPage={(number) => void page(number)} /> : null}
  </main>;
}
