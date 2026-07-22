"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { DeepAnalysisView, WeeklyReviewNarrationDto } from "@mentor/types";
import { Button, Card, Chip, SectionHeading, Skeleton, SkeletonGroup } from "@mentor/ui";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.mjs";
import { Link } from "@/i18n/navigation";
import {
  fetchDeepAnalysis,
  isEconomyDisabled,
  purchaseDeepAnalysis,
} from "@/lib/economy";
import { narrateWeeklyReview } from "@/lib/coach";

type CardState =
  | { status: "loading" }
  /** Economy off, review not eligible, or state fetch failed → render nothing (analysis stays clean). */
  | { status: "hidden" }
  | { status: "gate"; view: DeepAnalysisView }
  | { status: "narration"; data: WeeklyReviewNarrationDto };

/**
 * Deep-analysis (coin sink) card on /analysis: the premium weekly AI narration, unlockable per
 * (exam, week) with coin for free users. Analysis zone only — NEVER rendered in the coach chat
 * zone (§4 #3). Renders under the weekly-review card once the review is READY.
 */
export function AnalysisDeepAnalysisCard({ examId }: { examId: string }) {
  const t = useTranslations("analysis.deep");
  const [state, setState] = useState<CardState>({ status: "loading" });
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);

  // Mounted with key={examId} — an exam switch remounts with a fresh "loading" initial state.
  useEffect(() => {
    let cancelled = false;
    fetchDeepAnalysis(examId)
      .then((view) => {
        if (cancelled) return;
        setState(view.eligible ? { status: "gate", view } : { status: "hidden" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Flag off or transient failure — the analysis page must not break for a sink card.
        setState({ status: "hidden" });
        if (!isEconomyDisabled(err)) console.error(err);
      });
    return () => {
      cancelled = true;
    };
  }, [examId]);

  async function loadNarration() {
    setBusy(true);
    setActionError(false);
    try {
      const data = await narrateWeeklyReview(examId);
      setState({ status: "narration", data });
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  // Two-tap confirm (streak-rescue precedent): first tap arms, second tap spends.
  async function handleUnlockClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    setActionError(false);
    try {
      const next = await purchaseDeepAnalysis(examId);
      setState({ status: "gate", view: next });
      if (next.unlocked) await loadNarration();
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  if (state.status === "hidden") return null;

  if (state.status === "loading") {
    return (
      <SkeletonGroup label={t("loading")} className="block">
        <Card className="flex flex-col gap-4">
          <Skeleton className="h-6 w-40 rounded-[var(--radius-card)]" />
          <Skeleton className="h-4 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-11 w-48 rounded-[var(--radius-card)]" />
        </Card>
      </SkeletonGroup>
    );
  }

  if (state.status === "narration") {
    return (
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading subtitle={t("subtitle")}>{t("title")}</SectionHeading>
          <Chip>{t("unlocked_chip")}</Chip>
        </div>
        <p className="text-sm leading-6" style={{ color: "var(--color-body)" }}>
          {state.data.narration}
        </p>
        <div
          className="rounded-[var(--radius-card)] p-4"
          style={{ background: "var(--color-surface-container)" }}
        >
          <h3 className="text-sm font-bold" style={{ color: "var(--color-main)" }}>
            {t("suggested_title")}
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
            {state.data.suggestedTask.title}
          </p>
          <Link
            href={{
              pathname: "/plan",
              query: {
                add: "1",
                title: state.data.suggestedTask.title,
                ...(state.data.suggestedTask.subjectRef
                  ? { subject: state.data.suggestedTask.subjectRef }
                  : {}),
              },
            }}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-btn)] px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {t("add_to_plan")}
          </Link>
        </div>
      </Card>
    );
  }

  const { view } = state;
  return (
    <Card className="flex flex-col items-start gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-3">
        <SectionHeading subtitle={t("subtitle")}>{t("title")}</SectionHeading>
        {view.premium ? <Chip>{t("premium_chip")}</Chip> : null}
      </div>

      {view.unlocked ? (
        <>
          <p className="text-sm leading-6" style={{ color: "var(--color-secondary)" }}>
            {t("unlocked_hint")}
          </p>
          <Button type="button" onClick={() => void loadNarration()} disabled={busy}>
            {busy ? (
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {busy ? t("fetching") : t("fetch_cta")}
          </Button>
        </>
      ) : view.canAfford ? (
        <>
          <p className="text-sm leading-6" style={{ color: "var(--color-secondary)" }}>
            {t("locked_hint")}
          </p>
          <Button type="button" onClick={() => void handleUnlockClick()} disabled={busy}>
            {busy ? (
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {armed ? t("confirm_cta", { cost: view.cost }) : t("unlock_cta", { cost: view.cost })}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm leading-6" style={{ color: "var(--color-secondary)" }}>
            {t("insufficient", { cost: view.cost, balance: view.coinConfirmed })}
          </p>
          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] border border-black/10 bg-white px-4 text-sm font-bold text-[var(--color-main)] transition hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {t("go_earn")}
          </Link>
        </>
      )}

      {actionError ? (
        <p role="status" className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("action_error")}
        </p>
      ) : null}
    </Card>
  );
}
