"use client";
import { Sparkles } from "lucide-react";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import type {
  ApplyPlanAdaptationResultDto,
  CoachPlanAdaptationBriefDto,
} from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { useAppAvailability } from "@/lib/app-availability";
import { useAuth } from "@/lib/auth-context";
import { fetchPlanAdaptationBrief } from "@/lib/coach";
import { useMentorToast } from "@/lib/mentor-toast";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { useSubscription } from "@/lib/subscription-context";
import { PlanCoachAdaptationBrief } from "./plan-coach-adaptation-brief";
import type { PlanAdaptationKnownWeek } from "./plan-coach-adaptation-brief-note";
import { PlanCoachAdaptationStage } from "./plan-coach-adaptation-stage";
import { usePlanCoachGeneration } from "./use-plan-coach-generation";
import { usePlanCoachPreview, readCoachError } from "./use-plan-coach-preview";
import { fetchCoinPlanBrief, fetchSavedPlanPreview } from "@/lib/plan-previews";
import { refreshEconomySnapshot } from "@/lib/economy-store";
import { PlanCoinSheet } from "./plan-coin-sheet";
import { COIN_SHEET_ERRORS, planAccessView } from "./plan-coin-view";
import { newQuote, usePlanCoinFlow } from "./use-plan-coin-flow";

interface PlanCoachAdaptationActionProps {
  knownWeek: PlanAdaptationKnownWeek;
  onApplied: (result: ApplyPlanAdaptationResultDto) => Promise<void>;
  onPlanChanged: () => Promise<void>;
}

export interface PlanCoachAdaptationActionHandle {
  open: (input: CoachPlanAdaptationInput) => void;
}

export const PlanCoachAdaptationAction = forwardRef<
  PlanCoachAdaptationActionHandle,
  PlanCoachAdaptationActionProps
>(function PlanCoachAdaptationAction(
  { knownWeek, onApplied, onPlanChanged },
  ref,
) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const { openPaywall } = usePremiumPaywall();
  const toast = useMentorToast();
  const purchases = useAppAvailability()?.studentPurchases ?? false;
  const triggerRef = useRef<HTMLSpanElement>(null);
  const wizardLock = useRef(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [brief, setBrief] = useState<CoachPlanAdaptationBriefDto | null>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const { view: subscriptionView, refresh: refreshSubscription } =
    useSubscription();
  const coin = usePlanCoinFlow();
  const closeWizard = useCallback(() => {
    wizardLock.current = false;
    setWizardOpen(false);
  }, []);
  const showError = (error: unknown) =>
    toast.error({
      title: tCommon("error_title"),
      message: readCoachError(error, tCommon("error_unknown")),
    });
  const report = (message: string) => {
    if (wizardLock.current) setWizardError(message);
    else toast.error({ title: tCommon("error_title"), message });
  };
  const {
    stage,
    generate: generatePreview,
    finish: finishStage,
    cancel: cancelStage,
  } = usePlanCoachGeneration({
    busyRef,
    onBusy: setBusy,
    onStart: () => setWizardError(null),
    onPremium: () => {
      closeWizard();
      openPaywall({ sourceFeature: "plan.ai" });
    },
    onReady: (preview, input) => {
      closeWizard();
      void openPreview(preview, input);
    },
    onError: (error, paid) => {
      const message = readCoachError(error, tCommon("error_unknown"));
      if (!(paid && error instanceof ApiClientError && COIN_SHEET_ERRORS.has(error.body.code)))
        return report(message);
      // A changed price or a used allowance goes back to the sheet; the wizard keeps its answers underneath.
      void coin.refresh().then(
        () => coin.show({ armed: true, error: message, pending: paid.resume ? null : paid }),
        () => report(message),
      );
    },
    onSaved: () => {
      void refreshEconomySnapshot();
      void coin
        .refresh()
        .catch((error) =>
          console.error("Plan preview offer refresh failed", error),
        );
    },
  });
  const openPreview = usePlanCoachPreview({
    returnFocusRef: triggerRef,
    onApplied,
    onPlanChanged,
    onRegenerate: (input) => {
      if (input.source === "PLAN" && coin.offer?.mode === "COIN")
        void coin.refresh().then(() => coin.show({ pending: { input, progress: null } }), showError);
      else void generatePreview(input);
    },
  });

  async function readSaved(requestId: string) {
    const saved = await fetchSavedPlanPreview(requestId);
    if (saved.preview) {
      coin.setSheet(null);
      closeWizard();
      void openPreview(saved.preview, { source: "PLAN" });
    } else if (saved.state === "GENERATED") {
      coin.show({
        resume: { requestId, cost: saved.cost, input: { source: "PLAN" }, progress: null, resume: true },
      });
    }
  }

  /** `paid` is the Coin price confirmed in the sheet; null on the included path. */
  function openWizard(paid: number | null) {
    wizardLock.current = true;
    coin.setPaid(paid);
    // The wizard opens at once; the coach's reading lands in it when ready, and a failed read
    // leaves today's defaults.
    setBrief(null);
    setWizardError(null);
    void (paid === null ? fetchPlanAdaptationBrief() : fetchCoinPlanBrief()).then(setBrief, () => undefined);
    setWizardOpen(true);
  }

  function confirmSheet() {
    const { sheet, offer } = coin;
    if (!sheet) return;
    coin.setSheet(null);
    if (sheet.resume) return void generatePreview(sheet.resume.input, null, sheet.resume);
    if (offer?.cost == null) return;
    if (!sheet.pending) return openWizard(offer.cost);
    coin.setPaid(offer.cost);
    void generatePreview(sheet.pending.input, sheet.pending.progress, newQuote(sheet.pending, offer.cost));
  }

  async function open(input: CoachPlanAdaptationInput) {
    if (busyRef.current || wizardLock.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      // Shared read; only joins a request when the user hit this before it settled.
      // A failed read leaves `view` null (not loading) — retry instead of treating it as free.
      if (input.source !== "PLAN") {
        const view = subscriptionView ?? (await refreshSubscription());
        if (!isPremiumFeatureAvailable(view, "plan.ai")) {
          openPaywall({ sourceFeature: "plan.ai" });
          return;
        }
        await generatePreview(input);
        return;
      }

      const offer = await coin.refresh();
      // Off the Coin path a draft already paid for still opens; on it the sheet shows the way.
      if (offer.mode !== "COIN" && !offer.canGenerate && offer.latestRequestId)
        return await readSaved(offer.latestRequestId);
      const view = planAccessView(offer, purchases);
      if (view.kind === "paywall") openPaywall({ sourceFeature: "plan.ai" });
      else if (view.kind === "wizard") openWizard(null);
      else coin.show();
    } catch (error) {
      toast.error({
        title: tCommon("error_title"),
        message: readCoachError(error, tCommon("error_unknown")),
        duration: 3000,
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useImperativeHandle(ref, () => ({
    open: (input) => void open(input),
  }));

  const openSaved = () => {
    const id = coin.offer?.latestRequestId;
    if (id) void readSaved(id).catch(showError);
  };

  return (
    <>
      <span ref={triggerRef} className="contents">
        <Button
          type="button"
          variant="ghost"
          busy={busy}
          onClick={() => void open({ source: "PLAN" })}
          className="min-h-10 px-3 py-2 text-sm"
        >
          <Sparkles size={16} strokeWidth={2.25} aria-hidden />
          {t("coach_adaptation_cta")}
        </Button>
      </span>
      {coin.offer?.latestRequestId ? (
        <Button variant="ghost" size="sm" onClick={openSaved}>
          {t("coin_preview.saved")}
        </Button>
      ) : null}
      {wizardOpen ? (
        <PlanCoachAdaptationBrief
          knownWeek={knownWeek}
          brief={brief}
          profile={{
            examType: user?.examType ?? null,
            examVariant: user?.examVariant ?? null,
            dailyFocusGoalMinutes: user?.dailyFocusGoalMinutes ?? null,
          }}
          submitError={wizardError}
          submitLabel={coin.paid === null ? undefined : t("coin_preview.coin", { cost: coin.paid })}
          onClose={closeWizard}
          onComplete={(input, progress) => {
            if (busyRef.current) return;
            // The wizard stays open underneath, so a failed request finds the answers still there.
            void generatePreview(input, progress,
              coin.paid === null ? undefined : newQuote({ input, progress }, coin.paid));
          }}
        />
      ) : null}
      {coin.sheet && coin.offer ? (
        <PlanCoinSheet
          offer={coin.offer}
          sheet={coin.sheet}
          purchases={purchases}
          busy={busy}
          onArm={() => coin.setSheet((s) => s && { ...s, armed: true, error: null })}
          onCancel={() => coin.setSheet((s) => s && !s.resume ? { ...s, armed: false } : null)}
          onConfirm={confirmSheet}
          onPremium={() => {
            coin.setSheet(null);
            closeWizard();
            openPaywall({ sourceFeature: "plan.ai" });
          }}
          onRetry={() => void open({ source: "PLAN" })}
          onSaved={openSaved}
          onClose={() => coin.setSheet(null)}
        />
      ) : null}
      {stage ? (
        <PlanCoachAdaptationStage
          input={stage.input}
          knownWeek={knownWeek}
          brief={brief}
          progress={stage.progress}
          arrived={stage.arrived}
          onDone={finishStage}
          onCancel={cancelStage}
        />
      ) : null}
    </>
  );
});
