"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
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
  onInviteRequested?: () => void;
  quests: QuestProgressView[];
}

type QuestAction = "subscription" | "invite" | "verify-email";

function questAction(id: string): QuestAction | null {
  if (id === "onboarding.first-subscription") return "subscription";
  if (id === "onboarding.invite-redeemed") return "invite";
  if (id === "onboarding.email-verified") return "verify-email";
  return null;
}

/**
 * Onboarding quests — titles and completion from backend; no FE reward logic.
 */
export function EconomyQuestsCard({
  onInviteRequested,
  quests,
}: EconomyQuestsCardProps) {
  const translate = useTranslations("economy");
  const profileTranslate = useTranslations("profile");
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const toast = useMentorToast();
  const [resendingVerification, setResendingVerification] = useState(false);
  const completed = quests.filter((quest) => quest.completed).length;
  const percent =
    quests.length === 0 ? 0 : Math.round((completed / quests.length) * 100);

  async function handleAction(action: QuestAction) {
    if (action === "subscription") router.push("/abonelik");
    if (action === "invite") onInviteRequested?.();
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
    <div>
      <QuestProgressGauge
        percent={percent}
        percentLabel={translate("quests_percent", { percent })}
        progressLabel={translate("quests_progress", {
          done: completed,
          total: quests.length,
        })}
        stateLabel={translate("quests_gauge_state")}
        reduceMotion={reduceMotion ?? false}
      />

      <ul className="mt-4 flex flex-col gap-2">
        {quests.map((quest) => {
          const action = quest.completed ? null : questAction(quest.id);
          return (
            <QuestRow
              key={quest.id}
              action={action}
              busy={action === "verify-email" && resendingVerification}
              onAction={handleAction}
              quest={quest}
            />
          );
        })}
      </ul>
    </div>
  );
}

function QuestRow({
  action,
  busy,
  onAction,
  quest,
}: {
  action: QuestAction | null;
  busy: boolean;
  onAction: (action: QuestAction) => Promise<void>;
  quest: QuestProgressView;
}) {
  const translate = useTranslations("economy");
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
      <span className="min-w-0 flex-1 truncate text-left text-base font-semibold text-[var(--color-main)]">
        {quest.title}
      </span>
      {!quest.completed ? (
        <span className="shrink-0 text-sm font-bold text-[var(--color-chip-text)]">
          {translate("quest_reward", { count: quest.rewardCoin })}
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
          className="flex min-h-9 w-full min-w-0 items-center gap-3 rounded-[var(--radius-card)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] disabled:cursor-wait disabled:opacity-70"
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
