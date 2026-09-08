"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { QuestProgressView } from "@mentor/types";
import { RewardedAdOffer } from "@/components/ads/rewarded-ad-offer";
import { CoinCelebrationCard } from "@/components/coin-celebration-card";
import { QuestRowItem } from "./quest-row-item";

type QuestTabKey = QuestProgressView["category"];

export interface QuestSectionProps {
  activeTab?: QuestTabKey;
  tabbed: boolean;
  onAction: (action: QuestProgressView["action"]) => Promise<void>;
  quests: QuestProgressView[];
  reduceMotion: boolean;
  resendingVerification: boolean;
  rewardedAd?: Parameters<typeof RewardedAdOffer>[0];
  completedCount: number;
  totalCount: number;
}

/**
 * Renders the quest list panel or the celebratory all-done card state.
 */
export function QuestSection({
  activeTab,
  tabbed,
  onAction,
  quests,
  reduceMotion,
  resendingVerification,
  rewardedAd,
  completedCount,
  totalCount,
}: QuestSectionProps) {
  const translate = useTranslations("economy");
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  if (quests.length === 0 && !rewardedAd) return null;

  const isAllDone = quests.length > 0 && quests.every((quest) => quest.completed);

  return (
    <section
      aria-labelledby={tabbed && activeTab ? `quests-tab-${activeTab}` : undefined}
      className="mentor-scrollarea mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-1"
      id={activeTab ? `quests-panel-${activeTab}` : "quests-panel"}
      role={tabbed && activeTab ? "tabpanel" : undefined}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={`${activeTab}:${isAllDone ? "done" : "active"}`}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2 pt-1"
          exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }
          }
        >
          {isAllDone ? (
            <div className="flex flex-col gap-2.5">
              <CoinCelebrationCard
                badgeLabel={
                  activeTab === "daily_ritual"
                    ? translate("quests_daily_state")
                    : activeTab === "weekly_ritual"
                      ? translate("quests_tab_weekly")
                      : activeTab === "milestone"
                        ? translate("quests_tab_milestone")
                        : translate("quests_tab_onboarding")
                }
                title={translate("quests_completed_hero_title")}
                subtitle={translate("quests_completed_hero_subtitle")}
                completedCount={completedCount}
                totalCount={totalCount}
                showTasksToggle={true}
                tasksVisible={showCompletedTasks}
                onToggleTasks={() => setShowCompletedTasks((prev) => !prev)}
                reduceMotion={reduceMotion}
              />

              {rewardedAd ? <RewardedAdOffer {...rewardedAd} variant="list" /> : null}

              <AnimatePresence>
                {showCompletedTasks ? (
                  <motion.ul
                    initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex flex-col gap-2 pt-1 overflow-hidden"
                  >
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
                ) : null}
              </AnimatePresence>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
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
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
