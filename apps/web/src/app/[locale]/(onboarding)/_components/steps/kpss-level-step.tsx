"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser, ExamVariant } from "@mentor/types";
import { PlayButton } from "@/components/onboarding-play/play-button";
import { PlayOptionRow } from "@/components/onboarding-play/play-choice";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { PuhuBubble } from "@/components/onboarding-play/play-heading";
import { useAuth } from "@/lib/auth-context";
import { OnboardingStepLayout } from "../onboarding-step-layout";

const OPTIONS: ExamVariant[] = ["LISANS", "ONLISANS", "ORTAOGRETIM"];

export function KpssLevelStep({
  user,
  progress,
  onSaved,
  onBack,
}: {
  user: AuthUser;
  progress: { done: number; total: number } | null;
  onSaved: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("onboarding.kpss_level");
  const examCopy = useTranslations("profile.exam_settings");
  const { setUserFromServer } = useAuth();
  const [selected, setSelected] = useState<ExamVariant | null>(user.examType === "KPSS" ? user.examVariant : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = (await usersControllerUpdateMe({ examType: "KPSS", examVariant: selected })) as unknown as AuthUser;
      setUserFromServer(updated);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : t("save_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingStepLayout
      progress={progress}
      onBack={onBack}
      heading={<PuhuBubble title={t("title")} />}
      footer={
        <PlayFooter error={error}>
          <PlayButton onClick={() => void save()} busy={saving} disabled={!selected}>
            {t("continue")}
          </PlayButton>
        </PlayFooter>
      }
    >
      <div role="radiogroup" aria-label={t("title")} className="flex flex-col gap-3">
        {OPTIONS.map((value, index) => (
          <PlayOptionRow
            key={value}
            index={index}
            label={examCopy(`variant.${value}`)}
            selected={selected === value}
            disabled={saving}
            onSelect={() => setSelected(value)}
          />
        ))}
      </div>
    </OnboardingStepLayout>
  );
}
