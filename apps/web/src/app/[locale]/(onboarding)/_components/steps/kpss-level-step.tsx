"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser, ExamVariant } from "@mentor/types";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { OnboardingStepLayout } from "../onboarding-step-layout";
import { OptionButton } from "./exam-step";

const OPTIONS: ExamVariant[] = ["LISANS", "ONLISANS", "ORTAOGRETIM"];

export function KpssLevelStep({ user, onSaved, onBack }: { user: AuthUser; onSaved: () => void; onBack: () => void }) {
  const t = useTranslations("onboarding.kpss_level");
  const examCopy = useTranslations("profile.exam_settings");
  const { setUserFromServer } = useAuth();
  const [selected, setSelected] = useState<ExamVariant | null>(user.examType === "KPSS" ? user.examVariant : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!selected || saving) return;
    setSaving(true); setError(null);
    try {
      const updated = (await usersControllerUpdateMe({ examType: "KPSS", examVariant: selected })) as unknown as AuthUser;
      setUserFromServer(updated); onSaved();
    } catch (err) { setError(err instanceof ApiClientError ? err.body.message : t("save_error")); }
    finally { setSaving(false); }
  }

  return (
    <OnboardingStepLayout step={3} title={t("title")} onBack={onBack} primaryLabel={t("continue")} onPrimary={() => void save()} primaryBusy={saving} primaryDisabled={!selected || saving}>
      <FormError message={error} />
      <div role="radiogroup" aria-label={t("title")} className="mx-auto grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
        {OPTIONS.map((value) => <OptionButton key={value} label={examCopy(`variant.${value}`)} active={selected === value} disabled={saving} onClick={() => setSelected(value)} />)}
      </div>
    </OnboardingStepLayout>
  );
}
