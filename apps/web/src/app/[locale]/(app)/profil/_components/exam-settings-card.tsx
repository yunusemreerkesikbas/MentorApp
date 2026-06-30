"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type { AuthUser, ExamType } from "@mentor/types";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import { Card, SectionHeading } from "@mentor/ui";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { useMentorToast } from "@/lib/mentor-toast";

/**
 * Exam family picker — identity-owned `examType` unlocks countdown, bilgi, analiz.
 * Official exam dates come from editorial content (guardrail §1), not this control.
 */
export function ExamSettingsCard({
  user,
  onSaved,
}: {
  user: AuthUser;
  onSaved?: () => void;
}) {
  const t = useTranslations("profile.exam_settings");
  const { setUserFromServer } = useAuth();
  const { success: showSuccessToast } = useMentorToast();
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<ExamType | null>(user.examType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const EXAM_OPTIONS: {
    value: ExamType;
    label: string;
    description: string;
  }[] = [
    { value: "KPSS", label: "KPSS", description: t("kpss_desc") },
    { value: "YKS", label: "YKS", description: t("yks_desc") },
    { value: "LGS", label: "LGS", description: t("lgs_desc") },
  ];

  async function handleSelect(examType: ExamType) {
    if (examType === selected || saving) return;
    const prev = selected;
    setSelected(examType);
    setError(null);
    setSaving(true);
    try {
      const updated = (await usersControllerUpdateMe({
        examType,
      })) as unknown as AuthUser;
      setUserFromServer(updated);
      showSuccessToast({
        title: t("saved_toast_title"),
        message: t("saved_toast_message"),
        duration: 3000,
      });
      onSaved?.();
    } catch (err) {
      setSelected(prev);
      setError(
        err instanceof ApiClientError ? err.body.message : t("save_error"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card id="exam-settings">
      <SectionHeading subtitle={t("subtitle")}>{t("title")}</SectionHeading>

      {error ? <FormError message={error} /> : null}
      <div
        role="radiogroup"
        aria-label={t("aria_label")}
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onKeyDown={(e) => {
          const idx = EXAM_OPTIONS.findIndex((o) => o.value === selected);
          if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            e.preventDefault();
            const next = EXAM_OPTIONS[(idx + 1) % EXAM_OPTIONS.length];
            void handleSelect(next!.value);
          } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            e.preventDefault();
            const next =
              EXAM_OPTIONS[
                (idx - 1 + EXAM_OPTIONS.length) % EXAM_OPTIONS.length
              ];
            void handleSelect(next!.value);
          }
        }}
      >
        {EXAM_OPTIONS.map((opt) => {
          const active = selected === opt.value;
          return (
            <motion.button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving}
              onClick={() => void handleSelect(opt.value)}
              className="flex min-h-24 w-full flex-col items-start justify-between gap-3 rounded-[var(--radius-card)] border px-4 py-4 text-left transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60 motion-reduce:transition-none"
              style={{
                borderColor: active
                  ? "var(--color-main)"
                  : "color-mix(in srgb, var(--color-main) 12%, transparent)",
                backgroundColor: active ? "var(--color-main)" : "white",
                color: active ? "white" : "var(--color-main)",
              }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: active ? -2 : 0,
                      opacity: saving && !active ? 0.7 : 1,
                    }
              }
              transition={{ duration: 0.2 }}
            >
              <div className="flex w-full items-start justify-between gap-3">
                <span
                  className="text-lg font-bold"
                  style={{
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {opt.label}
                </span>
                {active ? (
                  <span
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-[var(--color-main)]"
                    aria-hidden
                  >
                    <Check size={16} strokeWidth={3} />
                  </span>
                ) : null}
              </div>
              <span className={active ? "text-sm text-white/75" : "text-sm text-[var(--color-secondary)]"}>
                {opt.description}
              </span>
            </motion.button>
          );
        })}
      </div>
    </Card>
  );
}
