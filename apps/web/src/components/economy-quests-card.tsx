"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { SlidingTabs, type SlidingTabItem } from "@mentor/ui";
import {
  ApiClientError,
  usersControllerResendVerificationEmail,
} from "@mentor/api-client";
import type { QuestProgressView } from "@mentor/types";
import { RewardedAdOffer } from "@/components/ads/rewarded-ad-offer";
import { useRouter } from "@/i18n/navigation";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  ECONOMY_CHANGED_EVENT,
  fetchQuests,
  notifyCoinCelebration,
} from "@/lib/economy";
import { findNewlyCompletedQuests } from "@/lib/economy-quest-utils";
import { QuestProgressGauge } from "./economy-quests/quest-progress-gauge";
import { QuestNextActionCard } from "./economy-quests/quest-next-action-card";
import { QuestSection } from "./economy-quests/quest-section";

export interface EconomyQuestsCardProps {
  onDismiss?: () => void;
  onInviteRequested?: () => void;
  quests: QuestProgressView[];
  rewardedAd?: {
    onCompleted?: Parameters<typeof RewardedAdOffer>[0]["onCompleted"];
    onOfferChange?: Parameters<typeof RewardedAdOffer>[0]["onOfferChange"];
    onUnavailable?: () => void;
  };
}

type QuestTabKey = QuestProgressView["category"];

/**
 * Economy Quests Card — redesigned companion quest checklist.
 * Features ambient radial gauge, SlidingTabs, and Reference 3-style task cards.
 */
export function EconomyQuestsCard({
  onDismiss,
  onInviteRequested,
  quests,
  rewardedAd,
}: EconomyQuestsCardProps) {
  const translate = useTranslations("economy");
  const profileTranslate = useTranslations("profile");
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const toast = useMentorToast();
  const [resendingVerification, setResendingVerification] = useState(false);
  const [selectedTab, setSelectedTab] = useState<QuestTabKey>("daily_ritual");
  const [renderedQuests, setRenderedQuests] = useState(quests);
  const [currentQuests, setCurrentQuests] = useState(quests);
  if (renderedQuests !== quests) {
    setRenderedQuests(quests);
    setCurrentQuests(quests);
  }
  const prevQuestsRef = useRef<QuestProgressView[] | null>(null);

  // Listen to economy changes to refresh dynamically
  useEffect(() => {
    function onEconomyChanged() {
      fetchQuests()
        .then((fresh) => {
          setCurrentQuests(fresh);
        })
        .catch(() => {});
    }
    window.addEventListener(ECONOMY_CHANGED_EVENT, onEconomyChanged);
    return () => window.removeEventListener(ECONOMY_CHANGED_EVENT, onEconomyChanged);
  }, []);

  useEffect(() => {
    if (prevQuestsRef.current) {
      const completedNow = findNewlyCompletedQuests(prevQuestsRef.current, currentQuests);
      const coinEarned = completedNow.reduce(
        (sum, quest) =>
          quest.rewardUnit === "COIN" ? sum + quest.rewardAmount : sum,
        0,
      );
      if (coinEarned > 0) {
        notifyCoinCelebration(coinEarned);
      }
    }
    prevQuestsRef.current = currentQuests;
  }, [currentQuests]);

  const dailyQuests = currentQuests.filter((quest) => quest.category === "daily_ritual");
  const weeklyQuests = currentQuests.filter((quest) => quest.category === "weekly_ritual");
  const milestoneQuests = currentQuests.filter((quest) => quest.category === "milestone");
  const onboardingQuests = currentQuests.filter((quest) => quest.category === "onboarding");

  const tabDefs = [
    {
      key: "daily_ritual" as const,
      label: translate("quests_tab_daily"),
      quests: dailyQuests,
    },
    {
      key: "weekly_ritual" as const,
      label: translate("quests_tab_weekly"),
      quests: weeklyQuests,
    },
    {
      key: "milestone" as const,
      label: translate("quests_tab_milestone"),
      quests: milestoneQuests,
    },
    {
      key: "onboarding" as const,
      label: translate("quests_tab_onboarding"),
      quests: onboardingQuests,
    },
  ];

  const questTabs = tabDefs.filter(
    (tab) => tab.quests.length > 0 || (tab.key === "daily_ritual" && Boolean(rewardedAd)),
  );

  const activeTab = questTabs.some((tab) => tab.key === selectedTab)
    ? selectedTab
    : questTabs[0]?.key;
  const activeQuests = questTabs.find((tab) => tab.key === activeTab)?.quests ?? [];
  const completed = dailyQuests.filter((quest) => quest.completed).length;
  const percent =
    dailyQuests.length === 0 ? 0 : Math.round((completed / dailyQuests.length) * 100);
  const nextQuest =
    dailyQuests.find((quest) => !quest.completed && quest.action) ??
    onboardingQuests.find((quest) => !quest.completed && quest.action) ??
    null;
  const promoteRewardedAd = Boolean(rewardedAd && !nextQuest);

  function navigateAfterDismiss(
    path: "/plan" | "/study-session" | "/dashboard" | "/subscription" | "/settings",
  ) {
    flushSync(() => {
      onDismiss?.();
    });
    router.push(path);
  }

  async function handleAction(action: QuestProgressView["action"]) {
    if (!action) return;
    if (action === "plan") {
      navigateAfterDismiss("/plan");
      return;
    }
    if (action === "study-session") {
      navigateAfterDismiss("/study-session");
      return;
    }
    if (action === "mood-checkin" || action === "panel") {
      navigateAfterDismiss("/dashboard");
      return;
    }
    if (action === "subscription") {
      navigateAfterDismiss("/subscription");
      return;
    }
    if (action === "invite") {
      if (onInviteRequested) {
        onInviteRequested();
        return;
      }
      navigateAfterDismiss("/settings");
      return;
    }
    if (action !== "verify-email" || resendingVerification) return;

    setResendingVerification(true);
    try {
      await usersControllerResendVerificationEmail();
      toast.success({
        title: profileTranslate("verification_sent_title"),
        message: profileTranslate("verification_sent_message"),
        duration: 3000,
      });
    } catch (err) {
      toast.error({
        title: profileTranslate("verification_send_error_title"),
        message:
          err instanceof ApiClientError
            ? err.body.message
            : profileTranslate("verification_send_error_message"),
        duration: 3000,
      });
    } finally {
      setResendingVerification(false);
    }
  }

  const slidingTabItems: SlidingTabItem[] = questTabs.map((tab) => {
    const tabCompleted = tab.quests.filter((quest) => quest.completed).length;
    return {
      id: tab.key,
      panelId: `quests-panel-${tab.key}`,
      label: (
        <span className="flex items-center justify-center gap-1.5 leading-tight whitespace-nowrap">
          <span className="text-xs font-bold whitespace-nowrap">{tab.label}</span>
          <span className="text-[10px] font-semibold opacity-75 tabular-nums">
            {tabCompleted}/{tab.quests.length}
          </span>
        </span>
      ),
    };
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 pb-1.5">
        <QuestProgressGauge
          allDoneLabel={translate("quests_all_done")}
          completed={completed}
          percent={percent}
          percentLabel={translate("quests_percent", { percent })}
          progressLabel={translate("quests_progress", {
            done: completed,
            total: dailyQuests.length,
          })}
          reduceMotion={reduceMotion}
          stateLabel={translate("quests_daily_state")}
          total={dailyQuests.length}
        />

        {nextQuest ? (
          <QuestNextActionCard
            nextQuest={nextQuest}
            nextStepLabel={translate("quest_next_step")}
            onAction={handleAction}
            reduceMotion={reduceMotion}
          />
        ) : rewardedAd && promoteRewardedAd ? (
          <div className="mt-3">
            <RewardedAdOffer {...rewardedAd} variant="promoted" />
          </div>
        ) : null}

        {questTabs.length > 1 ? (
          <div className="no-scrollbar mt-3.5 w-full overflow-x-auto overflow-y-hidden">
            <SlidingTabs
              ariaLabel={translate("quests_tabs_label")}
              className="no-scrollbar w-full [&_.t-tab]:min-h-9 [&_.t-tab]:px-2.5 [&_.t-tab]:text-xs"
              equalWidth={true}
              idPrefix="quests-tab"
              items={slidingTabItems}
              onChange={(id) => setSelectedTab(id as QuestTabKey)}
              value={activeTab ?? "daily_ritual"}
            />
          </div>
        ) : null}
      </div>

      <QuestSection
        activeTab={activeTab}
        tabbed={questTabs.length > 1}
        onAction={handleAction}
        quests={activeQuests}
        reduceMotion={reduceMotion}
        resendingVerification={resendingVerification}
        completedCount={completed}
        totalCount={dailyQuests.length}
        rewardedAd={
          activeTab === "daily_ritual" && rewardedAd && !promoteRewardedAd
            ? rewardedAd
            : undefined
        }
      />
    </div>
  );
}
