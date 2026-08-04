"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type { AuthUser, ExamType, ExamVariant } from "@mentor/types";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { OnboardingStepLayout } from "../onboarding-step-layout";

const KPSS_VARIANTS: ExamVariant[] = ["LISANS", "ONLISANS", "ORTAOGRETIM"];

export function ExamStep({
  user,
  onSaved,
  onBack,
}: {
  user: AuthUser;
  onSaved: (examType: ExamType) => void;
  onBack: () => void;
}) {
  const t = useTranslations("onboarding.exam");
  const examCopy = useTranslations("profile.exam_settings");
  const { setUserFromServer } = useAuth();
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<ExamType | null>(user.examType);
  const [variant, setVariant] = useState<ExamVariant | null>(user.examVariant);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const EXAM_OPTIONS: {
    value: ExamType;
    label: string;
    description: string;
  }[] = [
    { value: "KPSS", label: "KPSS", description: examCopy("kpss_desc") },
    { value: "YKS", label: "YKS", description: examCopy("yks_desc") },
    { value: "LGS", label: "LGS", description: examCopy("lgs_desc") },
  ];

  // Only KPSS splits, and the split is not optional: the three guides sit on different dates and
  // advertise different vacancies, so continuing without it would hand the candidate someone
  // else's countdown.
  const needsVariant = selected === "KPSS";

  async function handleContinue() {
    if (!selected || saving) return;
    if (needsVariant && !variant) return;
    const nextVariant = needsVariant ? variant : null;
    if (selected === user.examType && nextVariant === user.examVariant) {
      onSaved(selected);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = (await usersControllerUpdateMe({
        examType: selected,
        examVariant: nextVariant,
      })) as unknown as AuthUser;
      setUserFromServer(updated);
      onSaved(selected);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.body.message : t("save_error"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingStepLayout
      step={1}
      mascot="default"
      title={t("title")}
      subtitle={t("subtitle")}
      onBack={onBack}
      primaryLabel={t("continue")}
      onPrimary={() => void handleContinue()}
      primaryBusy={saving}
      primaryDisabled={!selected || (needsVariant && !variant)}
    >
      <FormError message={error} />
      <div
        role="radiogroup"
        aria-label={examCopy("aria_label")}
        className="flex flex-col gap-2"
      >
        {EXAM_OPTIONS.map((opt) => (
          <OptionButton
            key={opt.value}
            label={opt.label}
            description={opt.description}
            active={selected === opt.value}
            disabled={saving}
            reduceMotion={Boolean(reduceMotion)}
            onClick={() => setSelected(opt.value)}
          />
        ))}
      </div>

      {needsVariant ? (
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
            {examCopy("variant_label")}
          </span>
          <div
            role="radiogroup"
            aria-label={examCopy("variant_label")}
            className="flex flex-col gap-2"
          >
            {KPSS_VARIANTS.map((value) => (
              <OptionButton
                key={value}
                label={examCopy(`variant.${value}`)}
                description={examCopy(`variant_desc.${value}`)}
                active={variant === value}
                disabled={saving}
                reduceMotion={Boolean(reduceMotion)}
                onClick={() => setVariant(value)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </OnboardingStepLayout>
  );
}

/** Shared radio tile — the family and the KPSS level are the same choice at two depths. */
function OptionButton({
  label,
  description,
  active,
  disabled,
  reduceMotion,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  disabled: boolean;
  reduceMotion: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-card)] px-3 py-2.5 text-left transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 motion-reduce:transition-none"
      style={{
        border: active ? "2px solid var(--color-main)" : "1px solid transparent",
        backgroundColor: active
          ? "color-mix(in srgb, var(--color-chip) 25%, white)"
          : "rgba(255,255,255,0.65)",
      }}
      animate={
        reduceMotion
          ? undefined
          : { scale: active ? 1.01 : 1, opacity: disabled ? 0.85 : 1 }
      }
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-bold" style={{ color: "var(--color-main)" }}>
          {label}
        </span>
        <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {description}
        </span>
      </div>
      {active ? (
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: "var(--color-main)" }}
          aria-hidden
        >
          ✓
        </span>
      ) : null}
    </motion.button>
  );
}
