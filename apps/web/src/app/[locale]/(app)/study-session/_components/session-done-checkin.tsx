"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { PuhuCoachBubble } from "@/components/puhu-coach-bubble";
import { SuggestedTaskCard } from "@/components/suggested-task-card";
import { PremiumLockNudge } from "@/components/premium/premium-lock-nudge";

type SessionTranslate = ReturnType<typeof useTranslations<"session">>;

const MOODS = [
  { value: 1, emoji: "😩", labelKey: "mood_1" },
  { value: 2, emoji: "😐", labelKey: "mood_2" },
  { value: 3, emoji: "🙂", labelKey: "mood_3" },
] as const;

export function SessionDoneMoodCheckin({
  t,
  reduceMotion,
  mood,
  note,
  subject,
  saving,
  onMood,
  onNote,
  onSave,
}: {
  t: SessionTranslate;
  reduceMotion: boolean;
  mood: number | null;
  note: string;
  subject?: string | null;
  saving: boolean;
  onMood: (value: number) => void;
  onNote: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p
        className="text-sm font-semibold"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {t("checkin_title")}
      </p>
      <div className="flex justify-center gap-2 pb-6">
        {MOODS.map((m) => (
          <div key={m.value} className="group relative">
            <button
              type="button"
              onClick={() => onMood(m.value)}
              aria-pressed={mood === m.value}
              aria-label={t(m.labelKey)}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border text-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor:
                  mood === m.value
                    ? "var(--color-main)"
                    : "var(--color-progress-track)",
                boxShadow: mood === m.value ? "var(--shadow-card)" : undefined,
              }}
            >
              <span aria-hidden>{m.emoji}</span>
            </button>
            <span
              aria-hidden
              className="pointer-events-none absolute top-[calc(100%+0.25rem)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-card)] px-2 py-0.5 text-xs font-medium opacity-0 transition-opacity duration-150 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
              style={{
                backgroundColor: "var(--color-main)",
                color: "var(--color-surface)",
                fontFamily: "var(--font-body)",
              }}
            >
              {t(m.labelKey)}
            </span>
          </div>
        ))}
      </div>
      {mood != null ? (
        <motion.div
          className="flex w-full flex-col gap-3"
          {...(reduceMotion
            ? {}
            : {
                initial: { opacity: 0, height: 0 },
                animate: { opacity: 1, height: "auto" },
              })}
        >
          <input
            type="text"
            value={note}
            onChange={(e) => onNote(e.target.value)}
            maxLength={280}
            placeholder={
              subject
                ? t("checkin_note_subject", { subject })
                : t("checkin_note_placeholder")
            }
            className="w-full rounded-[var(--radius-card)] border bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2"
            style={{
              borderColor: "var(--color-progress-track)",
              color: "var(--color-main)",
            }}
          />
          <Button onClick={onSave} busy={saving} fullWidth size="sm">
            {t("checkin_save")}
          </Button>
        </motion.div>
      ) : null}
    </div>
  );
}

export function SessionDoneSavedCheckin({
  t,
  mood,
  sessionId,
  reflecting,
  reflectionLocked,
  reflection,
  suggestedTask,
  onOpenPaywall,
}: {
  t: SessionTranslate;
  mood: number | null;
  sessionId: string | null;
  reflecting: boolean;
  reflectionLocked: boolean;
  reflection: string | null;
  suggestedTask: { title: string; subject: string | null } | null;
  onOpenPaywall: () => void;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p
        className="text-sm font-semibold"
        style={{ color: "var(--color-main)" }}
        role="status"
      >
        {t("checkin_saved")}
      </p>
      {mood === 1 && sessionId ? (
        <Link
          href={{
            pathname: "/plan",
            query: {
              coach: "adapt",
              source: "session",
              sessionId,
            },
          }}
          className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-card)] border px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
          style={{
            borderColor: "var(--color-progress-track)",
            color: "var(--color-main)",
          }}
        >
          {t("coach_adaptation_cta")}
        </Link>
      ) : null}
      {reflecting ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }} role="status">
          {t("reflection_loading")}
        </p>
      ) : null}
      {reflectionLocked && !reflecting && !reflection ? (
        <PremiumLockNudge label={t("premium_nudge")} onClick={onOpenPaywall} />
      ) : null}
      {reflection ? (
        <PuhuCoachBubble
          message={reflection}
          variant="encouraging"
          dismissible
          className="flex w-full flex-col items-center"
          dismissLabel={t("reflection_dismiss")}
        />
      ) : null}
      {suggestedTask ? (
        <SuggestedTaskCard task={suggestedTask} className="flex w-full justify-center" />
      ) : null}
    </div>
  );
}
