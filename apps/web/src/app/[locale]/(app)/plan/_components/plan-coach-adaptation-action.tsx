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
import { Button } from "@mentor/ui";
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
import { PlanCoinDialog } from "./plan-coin-dialog";
import { usePlanCoinFlow } from "./use-plan-coin-flow";

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
    onError: (error) => {
      const message = readCoachError(error, tCommon("error_unknown"));
      if (wizardLock.current) setWizardError(message);
      else toast.error({ title: tCommon("error_title"), message });
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
    onRegenerate: (input) =>
      void (
        input.source === "PLAN" && coin.offer?.mode === "COIN"
          ? coin.request(input, null)
          : generatePreview(input)
      ).catch((error) =>
        toast.error({
          title: tCommon("error_title"),
          message: readCoachError(error, tCommon("error_unknown")),
        }),
      ),
  });

  async function readSaved(requestId: string) {
    const saved = await fetchSavedPlanPreview(requestId);
    if (saved.preview) {
      closeWizard();
      void openPreview(saved.preview, { source: "PLAN" });
    } else if (saved.state === "GENERATED") {
      coin.setQuote({
        requestId,
        cost: saved.cost,
        input: { source: "PLAN" },
        progress: null,
        resume: true,
      });
    }
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
      if (!offer.canGenerate) {
        if (offer.latestRequestId) await readSaved(offer.latestRequestId);
        else if (offer.reason === "PAYMENT_PREMIUM_REQUIRED")
          openPaywall({ sourceFeature: "plan.ai" });
        else coin.setBlocked(offer);
        return;
      }

      wizardLock.current = true;
      // The wizard opens at once; the coach's reading lands in it when ready, and a failed read
      // leaves today's defaults.
      setBrief(null);
      setWizardError(null);
      void (
        offer.mode === "COIN"
          ? fetchCoinPlanBrief()
          : fetchPlanAdaptationBrief()
      ).then(setBrief, () => undefined);
      setWizardOpen(true);
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void readSaved(coin.offer!.latestRequestId!).catch((error) =>
              toast.error({
                title: tCommon("error_title"),
                message: readCoachError(error, tCommon("error_unknown")),
              }),
            )
          }
        >
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
          onClose={closeWizard}
          onComplete={(input, progress) => {
            if (busyRef.current) return;
            // The wizard stays open underneath, so a failed request finds the answers still there.
            if (coin.offer?.mode === "COIN")
              void coin
                .request(input, progress)
                .catch((error) =>
                  setWizardError(
                    readCoachError(error, tCommon("error_unknown")),
                  ),
                );
            else void generatePreview(input, progress);
          }}
        />
      ) : null}
      {coin.quote || coin.blocked ? (
        <PlanCoinDialog
          cost={coin.quote?.cost ?? coin.blocked?.cost ?? null}
          message={coin.blocked?.message}
          canConfirm={coin.quote !== null}
          onClose={() => {
            coin.setQuote(null);
            coin.setBlocked(null);
          }}
          onPremium={
            coin.blocked?.mode === "COIN" &&
            (coin.blocked.reason === "INSUFFICIENT_COIN" ||
              coin.blocked.reason === "AI_PLAN_COIN_LIMIT_REACHED")
              ? () => {
                  coin.setBlocked(null);
                  closeWizard();
                  openPaywall({ sourceFeature: "plan.ai" });
                }
              : undefined
          }
          onConfirm={() => {
            const quote = coin.quote;
            if (!quote) return;
            coin.setQuote(null);
            void generatePreview(quote.input, quote.progress, quote);
          }}
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
