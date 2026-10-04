"use client";

import { useState } from "react";
import { Backpack, GraduationCap, Landmark, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser, ExamType } from "@mentor/types";
import { Button } from "@mentor/ui";
import { PlayIconWell, PlayOptionRow, type PlayWell } from "@/components/onboarding-play/play-choice";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { PuhuBubble } from "@/components/onboarding-play/play-heading";
import { useAuth } from "@/lib/auth-context";
import type { OnboardingAudience } from "../onboarding-flow";
import { OnboardingStepLayout } from "../onboarding-step-layout";

const OPTIONS: { value: ExamType; icon: LucideIcon; well: PlayWell }[] = [
  { value: "KPSS", icon: Landmark, well: "blue" },
  { value: "YKS", icon: GraduationCap, well: "peri" },
  { value: "LGS", icon: Backpack, well: "coral" },
];

/**
 * Which exam. Asked of a coach too, reworded (APP-089): same column either way, which is what lets
 * `hasCompletedOnboarding` stay untouched. KPSS waits for its level before saving.
 */
export function ExamStep({
  user,
  audience,
  progress,
  onSaved,
  onBack,
}: {
  user: AuthUser;
  audience: OnboardingAudience;
  progress: { done: number; total: number } | null;
  onSaved: (examType: ExamType) => void;
  onBack: () => void;
}) {
  const t = useTranslations("onboarding.exam");
  const title = audience === "coach" ? t("title_coach") : t("title");
  const { setUserFromServer } = useAuth();
  const [selected, setSelected] = useState<ExamType | null>(user.examType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!selected || saving) return;
    if (selected === "KPSS") {
      onSaved(selected);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = (await usersControllerUpdateMe({ examType: selected, examVariant: null })) as unknown as AuthUser;
      setUserFromServer(updated);
      onSaved(selected);
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
      heading={<PuhuBubble title={title} />}
      footer={
        <PlayFooter error={error}>
          <Button fullWidth onClick={() => void save()} busy={saving} disabled={!selected}>
            {t("continue")}
          </Button>
        </PlayFooter>
      }
    >
      <div role="radiogroup" aria-label={title} className="flex flex-col gap-3">
        {OPTIONS.map(({ value, icon: Icon, well }, index) => (
          <PlayOptionRow
            key={value}
            index={index}
            label={value}
            sub={t(`options.${value}`)}
            lead={
              <PlayIconWell well={well}>
                <Icon size={22} />
              </PlayIconWell>
            }
            selected={selected === value}
            disabled={saving}
            onSelect={() => setSelected(value)}
          />
        ))}
      </div>
    </OnboardingStepLayout>
  );
}
