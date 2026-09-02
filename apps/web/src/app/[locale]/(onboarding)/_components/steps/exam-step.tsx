"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser, ExamType } from "@mentor/types";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { OnboardingStepLayout } from "../onboarding-step-layout";

const OPTIONS: ExamType[] = ["KPSS", "YKS", "LGS"];

export function ExamStep({ user, onSaved, onBack }: { user: AuthUser; onSaved: (examType: ExamType) => void; onBack: () => void }) {
  const t = useTranslations("onboarding.exam");
  const { setUserFromServer } = useAuth();
  const [selected, setSelected] = useState<ExamType | null>(user.examType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!selected || saving) return;
    if (selected === "KPSS") { onSaved(selected); return; }
    setSaving(true); setError(null);
    try {
      const updated = (await usersControllerUpdateMe({ examType: selected, examVariant: null })) as unknown as AuthUser;
      setUserFromServer(updated); onSaved(selected);
    } catch (err) { setError(err instanceof ApiClientError ? err.body.message : t("save_error")); }
    finally { setSaving(false); }
  }

  return (
    <OnboardingStepLayout step={2} title={t("title")} onBack={onBack} primaryLabel={t("continue")} onPrimary={() => void save()} primaryBusy={saving} primaryDisabled={!selected || saving}>
      <FormError message={error} />
      <div role="radiogroup" aria-label={t("title")} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OPTIONS.map((value) => <OptionButton key={value} label={value} active={selected === value} disabled={saving} onClick={() => setSelected(value)} />)}
      </div>
    </OnboardingStepLayout>
  );
}

export function OptionButton({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button type="button" role="radio" aria-checked={active} disabled={disabled} onClick={onClick} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left font-bold text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60" style={{ border: active ? "2px solid var(--color-main)" : "1px solid var(--color-border)", backgroundColor: active ? "color-mix(in srgb, var(--color-chip) 25%, var(--color-surface))" : "var(--color-surface)" }} animate={reduceMotion ? undefined : { scale: active ? 1.015 : 1 }}>
      {label}<span aria-hidden>{active ? "✓" : ""}</span>
    </motion.button>
  );
}
