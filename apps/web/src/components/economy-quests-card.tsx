"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ApiClientError,
  usersControllerResendVerificationEmail,
} from "@mentor/api-client";
import type { QuestProgressView } from "@mentor/types";
import { useRouter } from "@/i18n/navigation";
import { useMentorToast } from "@/lib/mentor-toast";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2.mjs";
import Clock3 from "lucide-react/dist/esm/icons/clock-3.mjs";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.mjs";

interface EconomyQuestsCardProps {
  onDismiss?: () => void;
  onInviteRequested?: () => void;
  quests: QuestProgressView[];
}

type QuestTabKey = QuestProgressView["category"];

/**
 * Onboarding quests — titles and completion from backend; no FE reward logic.
 */
export function EconomyQuestsCard({
  onDismiss,
  onInviteRequested,
  quests,
}: EconomyQuestsCardProps) {
  const translate = useTranslations("economy");
  const profileTranslate = useTranslations("profile");
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const toast = useMentorToast();
  const [resendingVerification, setResendingVerification] = useState(false);
  const [selectedTab, setSelectedTab] = useState<QuestTabKey>("daily_ritual");
  const dailyQuests = quests.filter((quest) => quest.category === "daily_ritual");
  const weeklyQuests = quests.filter((quest) => quest.category === "weekly_ritual");
  const milestoneQuests = quests.filter((quest) => quest.category === "milestone");
  const onboardingQuests = quests.filter((quest) => quest.category === "onboarding");
  const questTabs = ([
    { key: "daily_ritual", label: translate("quests_daily_section"), quests: dailyQuests },
    { key: "weekly_ritual", label: translate("quests_weekly_section"), quests: weeklyQuests },
    { key: "milestone", label: translate("quests_milestone_section"), quests: milestoneQuests },
    { key: "onboarding", label: translate("quests_onboarding_section"), quests: onboardingQuests },
  ] satisfies Array<{
    key: QuestTabKey;
    label: string;
    quests: QuestProgressView[];
  }>).filter((tab) => tab.quests.length > 0);
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

  function navigateAfterDismiss(path: "/plan" | "/seans" | "/panel" | "/abonelik" | "/profil") {
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
      navigateAfterDismiss("/seans");
      return;
    }
    if (action === "mood-checkin") {
      navigateAfterDismiss("/panel");
      return;
    }
    if (action === "panel") {
      navigateAfterDismiss("/panel");
      return;
    }
    if (action === "subscription") {
      navigateAfterDismiss("/abonelik");
      return;
    }
    if (action === "invite") {
      if (onInviteRequested) {
        onInviteRequested();
        return;
      }
      navigateAfterDismiss("/profil");
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 bg-white pb-3">
        <QuestProgressGauge
          percent={percent}
          percentLabel={translate("quests_percent", { percent })}
          progressLabel={translate("quests_progress", {
            done: completed,
            total: dailyQuests.length,
          })}
          stateLabel={translate("quests_daily_state")}
          reduceMotion={reduceMotion ?? false}
        />

        {nextQuest ? (
          <button
            type="button"
            className="mt-3 flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-card)] border border-black/10 bg-white px-4 py-3 text-left shadow-[var(--shadow-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
            onClick={() => void handleAction(nextQuest.action)}
          >
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase text-[var(--color-secondary)]">
                {translate("quest_next_step")}
              </span>
              <span className="mt-1 block truncate text-base font-extrabold text-[var(--color-main)]">
                {nextQuest.title}
              </span>
            </span>
            <ArrowRight className="shrink-0 text-[var(--color-main)]" size={18} aria-hidden />
          </button>
        ) : null}

        {questTabs.length > 1 ? (
          <div
            aria-label={translate("quests_tabs_label")}
            className="mt-3 flex rounded-[var(--radius-card)] border border-black/10 bg-black/[0.04] p-1"
            role="tablist"
          >
            {questTabs.map((tab) => {
              const tabCompleted = tab.quests.filter((quest) => quest.completed).length;
              const selected = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  aria-controls="quests-panel"
                  aria-selected={selected}
                  className={`relative min-w-0 flex-1 rounded-[var(--radius-card)] px-2 py-2 text-center text-xs font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] motion-reduce:transition-none ${
                    selected ? "text-[var(--color-main)]" : "text-[var(--color-secondary)] hover:text-[var(--color-main)]"
                  }`}
                  id={`quests-tab-${tab.key}`}
                  onClick={() => setSelectedTab(tab.key)}
                  role="tab"
                  type="button"
                >
                  {selected ? (
                    <motion.span
                      className="absolute inset-0 rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]"
                      layoutId="quest-tab-indicator"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
                      }
                    />
                  ) : null}
                  <span className="relative block truncate">{tab.label}</span>
                  <span className="relative mt-0.5 block tabular-nums">
                    {tabCompleted}/{tab.quests.length}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <QuestSection
        animationKey={activeTab}
        labelledBy={activeTab ? `quests-tab-${activeTab}` : undefined}
        panelId="quests-panel"
        quests={activeQuests}
        reduceMotion={reduceMotion ?? false}
        resendingVerification={resendingVerification}
        onAction={handleAction}
      />
    </div>
  );
}

function QuestSection({
  animationKey,
  onAction,
  labelledBy,
  panelId,
  quests,
  reduceMotion,
  resendingVerification,
}: {
  animationKey?: string;
  labelledBy?: string;
  onAction: (action: QuestProgressView["action"]) => Promise<void>;
  panelId?: string;
  quests: QuestProgressView[];
  reduceMotion: boolean;
  resendingVerification: boolean;
}) {
  if (quests.length === 0) return null;
  return (
    <section
      aria-labelledby={labelledBy}
      className="mentor-scrollarea mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
      id={panelId}
      role={labelledBy ? "tabpanel" : undefined}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.ul
          key={animationKey}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex flex-col gap-2"
          exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
        >
          {quests.map((quest) => (
            <QuestRow
              key={`${quest.id}:${quest.periodKey}`}
              busy={quest.action === "verify-email" && resendingVerification}
              onAction={onAction}
              quest={quest}
            />
          ))}
        </motion.ul>
      </AnimatePresence>
    </section>
  );
}

function QuestRow({
  busy,
  onAction,
  quest,
}: {
  busy: boolean;
  onAction: (action: QuestProgressView["action"]) => Promise<void>;
  quest: QuestProgressView;
}) {
  const translate = useTranslations("economy");
  const action = quest.completed ? null : quest.action;
  const progressCurrent = quest.progressCurrent;
  const progressTarget = quest.progressTarget;
  const hasProgress = progressCurrent !== undefined && progressTarget !== undefined;
  const progressPercent =
    hasProgress && progressTarget > 0
      ? Math.min(100, Math.max(0, (progressCurrent / progressTarget) * 100))
      : 0;
  const content = (
    <>
      <span
        className="grid size-6 shrink-0 place-items-center"
        style={{
          color: quest.completed ? "var(--color-success)" : "var(--color-chip-text)",
        }}
      >
        {quest.completed ? (
          <CheckCircle2 size={20} strokeWidth={2.2} aria-hidden />
        ) : (
          <Clock3 size={20} strokeWidth={2.2} aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-base font-semibold text-[var(--color-main)]">
          {quest.title}
        </span>
        <span className="mt-1 block text-xs font-bold text-[var(--color-secondary)]">
          {quest.badgeLabel}
          {hasProgress
            ? ` · ${translate(
                // Only streak-style quests count days; session/task quests are plain counts.
                quest.id.startsWith("milestone.streak.") || quest.id === "weekly.streak-full-week"
                  ? "quest_progress_days"
                  : "quest_progress_count",
                {
                  current: progressCurrent,
                  target: progressTarget,
                },
              )}`
            : null}
        </span>
        {hasProgress ? (
          <span
            aria-hidden="true"
            className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--color-progress-track)]"
          >
            <span
              className="block h-full rounded-full bg-[var(--color-progress)]"
              style={{ width: `${progressPercent}%` }}
            />
          </span>
        ) : null}
      </span>
      {!quest.completed ? (
        <span className="shrink-0 text-sm font-bold text-[var(--color-chip-text)]">
          {rewardLabel(translate, quest)}
        </span>
      ) : null}
      {action ? (
        busy ? (
          <LoaderCircle
            className="shrink-0 animate-spin text-[var(--color-main)] motion-reduce:animate-none"
            size={17}
            aria-hidden
          />
        ) : (
          <ArrowRight
            className="shrink-0 text-[var(--color-main)]"
            size={17}
            aria-hidden
          />
        )
      ) : null}
    </>
  );

  return (
    <li
      className={`rounded-[var(--radius-card)] bg-white/60 p-3 ${
        quest.completed ? "opacity-55" : ""
      }`}
    >
      {action ? (
        <button
          type="button"
          className="flex min-h-9 w-full min-w-0 cursor-pointer items-center gap-3 rounded-[var(--radius-card)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] disabled:cursor-wait disabled:opacity-70"
          disabled={busy}
          onClick={() => void onAction(action)}
        >
          {content}
        </button>
      ) : (
        <div className="flex min-h-9 min-w-0 items-center gap-3">{content}</div>
      )}
    </li>
  );
}

function rewardLabel(
  translate: ReturnType<typeof useTranslations>,
  quest: QuestProgressView,
): string {
  if (quest.rewardUnit === "XP") return translate("quest_reward_xp", { count: quest.rewardAmount });
  if (quest.rewardUnit === "COIN") return translate("quest_reward_coin", { count: quest.rewardAmount });
  return "";
}

function QuestProgressGauge({
  percent,
  percentLabel,
  progressLabel,
  reduceMotion,
  stateLabel,
}: {
  percent: number;
  percentLabel: string;
  progressLabel: string;
  reduceMotion: boolean;
  stateLabel: string;
}) {
  const arcPath = "M 24 128 A 116 116 0 0 1 256 128";
  const progress = Math.min(100, Math.max(0, percent)) / 100;

  return (
    <div className="mt-4 rounded-[var(--radius-card)] bg-white/60 px-4 pb-3 pt-4 shadow-[var(--shadow-card)]">
      <div className="relative mx-auto h-[140px] w-full max-w-[360px]">
        <svg
          aria-label={`${progressLabel} ${percentLabel}`}
          className="h-full w-full overflow-visible"
          role="img"
          viewBox="0 8 280 136"
        >
          <path
            d={arcPath}
            fill="none"
            pathLength={1}
            stroke="color-mix(in srgb, var(--color-progress-track) 70%, white)"
            strokeLinecap="round"
            strokeWidth={14}
          />
          <motion.path
            animate={{ pathLength: progress }}
            d={arcPath}
            fill="none"
            initial={{ pathLength: reduceMotion ? progress : 0 }}
            pathLength={1}
            stroke="var(--color-progress)"
            strokeLinecap="round"
            strokeWidth={14}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }
            }
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
          <span className="text-sm font-semibold text-[var(--color-secondary)]">
            {stateLabel}
          </span>
          <span className="mt-1 flex items-baseline justify-center text-[var(--color-main)]">
            <span className="text-4xl font-extrabold tabular-nums leading-none">
              {percentLabel}
            </span>
          </span>
          <span className="mt-2 text-sm font-semibold text-[var(--color-secondary)]">
            {progressLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
