"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SlidingTabs, type SlidingTabItem } from "@mentor/ui";
import {
  ApiClientError,
  usersControllerResendVerificationEmail,
} from "@mentor/api-client";
import type { QuestProgressView } from "@mentor/types";
import { RewardedAdOffer } from "@/components/ads/rewarded-ad-offer";
import { useRouter } from "@/i18n/navigation";
import { useMentorToast } from "@/lib/mentor-toast";
import { notifyCoinCelebration } from "@/lib/economy";
import { findNewlyCompletedQuests } from "@/lib/economy-quest-utils";
import { QuestProgressGauge } from "./economy-quests/quest-progress-gauge";
import { QuestNextActionCard } from "./economy-quests/quest-next-action-card";
import { QuestRowItem } from "./economy-quests/quest-row-item";

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
  const prevQuestsRef = useRef<QuestProgressView[] | null>(null);

  useEffect(() => {
    if (prevQuestsRef.current) {
      const completedNow = findNewlyCompletedQuests(prevQuestsRef.current, quests);
      const coinEarned = completedNow.reduce(
        (sum, quest) =>
          quest.rewardUnit === "COIN" ? sum + quest.rewardAmount : sum,
        0,
      );
      if (coinEarned > 0) {
        notifyCoinCelebration(coinEarned);
      }
    }
    prevQuestsRef.current = quests;
  }, [quests]);

  const dailyQuests = quests.filter((quest) => quest.category === "daily_ritual");
  const weeklyQuests = quests.filter((quest) => quest.category === "weekly_ritual");
  const milestoneQuests = quests.filter((quest) => quest.category === "milestone");
  const onboardingQuests = quests.filter((quest) => quest.category === "onboarding");

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
        <span className="flex items-center justify-center gap-1 leading-tight">
          <span className="truncate text-xs font-bold">{tab.label}</span>
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
          <div className="no-scrollbar mt-3.5 w-full overflow-hidden">
            <SlidingTabs
              ariaLabel={translate("quests_tabs_label")}
              className="no-scrollbar w-full [&_.t-tab]:min-h-9 [&_.t-tab]:px-1.5 [&_.t-tab]:text-xs"
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
        onAction={handleAction}
        quests={activeQuests}
        reduceMotion={reduceMotion}
        resendingVerification={resendingVerification}
        rewardedAd={
          activeTab === "daily_ritual" && rewardedAd && !promoteRewardedAd
            ? rewardedAd
            : undefined
        }
      />
    </div>
  );
}

function QuestSection({
  activeTab,
  onAction,
  quests,
  reduceMotion,
  resendingVerification,
  rewardedAd,
}: {
  activeTab?: QuestTabKey;
  onAction: (action: QuestProgressView["action"]) => Promise<void>;
  quests: QuestProgressView[];
  reduceMotion: boolean;
  resendingVerification: boolean;
  rewardedAd?: EconomyQuestsCardProps["rewardedAd"];
}) {
  if (quests.length === 0 && !rewardedAd) return null;

  return (
    <section
      aria-labelledby={activeTab ? `quests-tab-${activeTab}` : undefined}
      className="mentor-scrollarea mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-1"
      id={activeTab ? `quests-panel-${activeTab}` : "quests-panel"}
      role={activeTab ? "tabpanel" : undefined}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.ul
          key={activeTab}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2 pt-1"
          exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }
          }
        >
          {rewardedAd ? <RewardedAdOffer {...rewardedAd} variant="list" /> : null}
          {quests.map((quest) => (
            <QuestRowItem
              key={`${quest.id}:${quest.periodKey}`}
              busy={quest.action === "verify-email" && resendingVerification}
              onAction={onAction}
              quest={quest}
              reduceMotion={reduceMotion}
            />
          ))}
        </motion.ul>
      </AnimatePresence>
    </section>
  );
}
