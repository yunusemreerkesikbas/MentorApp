"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type { AuthUser, ExamType } from "@mentor/types";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import { Card, SectionHeading } from "@mentor/ui";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";

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
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<ExamType | null>(user.examType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

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
    setSavedHint(null);
    setSaving(true);
    try {
      const updated = (await usersControllerUpdateMe({
        examType,
      })) as unknown as AuthUser;
      setUserFromServer(updated);
      setSavedHint(t("saved"));
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
    <Card>
      <SectionHeading subtitle={t("subtitle")}>{t("title")}</SectionHeading>

      {error ? <FormError message={error} /> : null}
      <div
        role="radiogroup"
        aria-label={t("aria_label")}
        className="mt-4 flex flex-col gap-3"
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
              className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 motion-reduce:transition-none"
              style={{
                border: active
                  ? "2px solid var(--color-main)"
                  : "1px solid #ffffff",
                backgroundColor: active
                  ? "color-mix(in srgb, var(--color-chip) 20%, transparent)"
                  : "rgba(255,255,255,0.35)",
                boxShadow: "var(--shadow-card)",
              }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      scale: active ? 1.02 : 1,
                      opacity: saving && !active ? 0.7 : 1,
                    }
              }
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-base font-bold"
                  style={{
                    color: "var(--color-main)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {opt.label}
                </span>
                <span
                  className="text-sm"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {opt.description}
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
        })}
      </div>

      {savedHint ? (
        <p
          className="mt-3 text-sm"
          style={{ color: "var(--color-secondary)" }}
          role="status"
        >
          {savedHint}
        </p>
      ) : null}
    </Card>
  );
}
