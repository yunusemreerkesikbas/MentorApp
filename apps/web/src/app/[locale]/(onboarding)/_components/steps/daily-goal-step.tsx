"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
import { Button, StreamingText } from "@mentor/ui";
import { PlayGridCard } from "@/components/onboarding-play/play-choice";
import { MinuteEntryCard } from "@/components/onboarding-play/minute-entry-card";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { PlayTitle } from "@/components/onboarding-play/play-heading";
import { PuhuImage, type PuhuVariant } from "@/components/puhu-image";
import { useAuth } from "@/lib/auth-context";
import { OnboardingStepLayout } from "../onboarding-step-layout";
import { PushPermissionLayer, usePushPermissionAsk } from "./push-permission-layer";

const GOALS: { minutes: 60 | 120 | 240 | 360; puhu: PuhuVariant }[] = [
  { minutes: 60, puhu: "default" },
  { minutes: 120, puhu: "happy" },
  { minutes: 240, puhu: "encouraging" },
  { minutes: 360, puhu: "surprised" },
];
const RECOMMENDED = 120;

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
    user.dailyFocusGoalMinutes != null && Number.isInteger(user.dailyFocusGoalMinutes) && user.dailyFocusGoalMinutes >= 10 && user.dailyFocusGoalMinutes <= 600
      ? user.dailyFocusGoalMinutes : null,
  );
  const custom = selected != null && !GOALS.some((goal) => goal.minutes === selected);
  const valid = selected != null && Number.isInteger(selected) && selected >= 10 && selected <= 600;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!valid || saving) return;
    const reminder = permission.ask();
    setSaving(true);
    setError(null);
    try {
      const updated = (await usersControllerUpdateMe({ dailyFocusGoalMinutes: selected! })) as unknown as AuthUser;
      setUserFromServer(updated);
    } catch (err) {
      permission.dismiss();
      setError(err instanceof ApiClientError ? err.body.message : t("save_error"));
      setSaving(false);
      return;
    }
    const subscribed = reminder ? await reminder : false;
    setSaving(false);
    onSaved(selected!, subscribed);
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
          <Button fullWidth onClick={() => void save()} busy={saving} disabled={!valid}>
            {t("continue")}
          </Button>
        </PlayFooter>
      }
    >
      <div role="group" aria-label={t("title")} className="grid grid-cols-2 gap-3 pt-3">
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
        <MinuteEntryCard
          label={t("custom")}
          unit={t("unit")}
          value={selected}
          selected={custom}
          disabled={saving}
          invalidMessage={t("invalid")}
          onChange={setSelected}
        />
      </div>
      {/*
        The cards carry the Puhus here, so the reaction is a bubble under them rather than a header.
        The fixed height keeps the caption from jumping when the first answer lands.
      */}
      <div aria-live="polite" className="mt-5 min-h-14">
        {valid ? (
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
              <StreamingText key={selected} text={custom ? t("reactions.custom") : t(`reactions.${selected}`)} />
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
