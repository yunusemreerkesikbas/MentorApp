"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
import { StreamingText } from "@mentor/ui";
import { PlayButton } from "@/components/onboarding-play/play-button";
import { PlayGridCard } from "@/components/onboarding-play/play-choice";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { PlayTitle } from "@/components/onboarding-play/play-heading";
import { PuhuImage, type PuhuVariant } from "@/components/puhu-image";
import { useAuth } from "@/lib/auth-context";
import { OnboardingStepLayout } from "../onboarding-step-layout";
import { PushPermissionLayer, usePushPermissionAsk } from "./push-permission-layer";

const GOALS: { minutes: 15 | 30 | 60 | 90; puhu: PuhuVariant }[] = [
  { minutes: 15, puhu: "default" },
  { minutes: 30, puhu: "happy" },
  { minutes: 60, puhu: "encouraging" },
  { minutes: 90, puhu: "surprised" },
];
const RECOMMENDED = 30;

export function DailyGoalStep({
  user,
  progress,
  onBack,
  onSkip,
  onSaved,
}: {
  user: AuthUser;
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSkip: () => void;
  onSaved: (minutes: number, reminder: boolean) => void;
}) {
  const t = useTranslations("onboarding.daily_goal");
  const push = useTranslations("onboarding.push");
  const { setUserFromServer } = useAuth();
  const reduceMotion = useReducedMotion();
  const permission = usePushPermissionAsk();
  const [selected, setSelected] = useState<number | null>(() =>
    GOALS.some((goal) => goal.minutes === user.dailyFocusGoalMinutes) ? user.dailyFocusGoalMinutes : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!selected || saving) return;
    const reminder = permission.ask();
    setSaving(true);
    setError(null);
    try {
      const updated = (await usersControllerUpdateMe({ dailyFocusGoalMinutes: selected })) as unknown as AuthUser;
      setUserFromServer(updated);
    } catch (err) {
      permission.dismiss();
      setError(err instanceof ApiClientError ? err.body.message : t("save_error"));
      setSaving(false);
      return;
    }
    const subscribed = reminder ? await reminder : false;
    setSaving(false);
    onSaved(selected, subscribed);
  }

  return (
    <OnboardingStepLayout
      progress={progress}
      onBack={onBack}
      skipLabel={t("skip")}
      onSkip={onSkip}
      heading={<PlayTitle title={t("title")} />}
      footer={
        <PlayFooter error={error}>
          <PlayButton onClick={() => void save()} busy={saving} disabled={!selected}>
            {t("continue")}
          </PlayButton>
        </PlayFooter>
      }
    >
      <div role="radiogroup" aria-label={t("title")} className="grid grid-cols-2 gap-3 pt-3">
        {GOALS.map(({ minutes, puhu }, index) => (
          <PlayGridCard
            key={minutes}
            index={index}
            label={t(`levels.${minutes}`)}
            sub={t("minutes", { minutes })}
            badge={minutes === RECOMMENDED ? t("recommended") : undefined}
            art={<PuhuImage variant={puhu} size={88} />}
            selected={selected === minutes}
            disabled={saving}
            onSelect={() => setSelected(minutes)}
          />
        ))}
      </div>
      {/*
        The cards carry the Puhus here, so the reaction is a bubble under them rather than a header.
        The fixed height keeps the caption from jumping when the first answer lands.
      */}
      <div aria-live="polite" className="mt-5 min-h-14">
        {selected ? (
          <motion.p
            key={selected}
            className="relative rounded-[var(--play-radius)] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-4 py-3 text-center text-base font-bold leading-snug text-[var(--color-main)]"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <span
              aria-hidden
              className="absolute -top-[9px] left-1/2 size-3.5 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-[var(--play-line)] bg-[var(--color-surface)]"
            />
            <span className="relative">
              <StreamingText key={selected} text={t(`reactions.${selected}`)} />
            </span>
          </motion.p>
        ) : null}
      </div>
      <p className="mt-3 text-center text-sm font-medium text-[var(--color-secondary)]">{t("caption")}</p>
      <PushPermissionLayer
        open={permission.open}
        title={push("title", { minutes: selected ?? RECOMMENDED })}
        body={push("body")}
        skipLabel={push("skip")}
        onSkip={permission.dismiss}
      />
    </OnboardingStepLayout>
  );
}
