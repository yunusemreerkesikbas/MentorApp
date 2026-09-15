"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
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
        {GOALS.map(({ minutes, puhu }) => (
          <PlayGridCard
            key={minutes}
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
      <p className="mt-4 text-center text-sm font-medium text-[var(--color-secondary)]">{t("caption")}</p>
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
