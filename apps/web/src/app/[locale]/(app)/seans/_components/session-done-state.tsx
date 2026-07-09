"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { PuhuCoachBubble } from "@/components/puhu-coach-bubble";
import { fetchCoachAccess, requestSessionReflection } from "@/lib/coach";

export interface SessionDoneStateProps {
  focusElapsed: number;
  /** Finalized session id — required for premium AI reflection after check-in. */
  sessionId: string | null;
  /** Subject carried from the session, used to personalise the note placeholder. */
  subject?: string | null;
  /** Persists the post-session micro check-in; rejects on API error (toast shown upstream). */
  onSubmitFeedback: (mood: number, struggleNote?: string) => Promise<void>;
  onReset: () => void;
}

/** Effort/mood options (roadmap §258: 😩😐🙂), stored as 1-3. */
const MOODS = [
  { value: 1, emoji: "😩", labelKey: "mood_1" },
  { value: 2, emoji: "😐", labelKey: "mood_2" },
  { value: 3, emoji: "🙂", labelKey: "mood_3" },
] as const;

export function SessionDoneState({
  focusElapsed,
  sessionId,
  subject,
  onSubmitFeedback,
  onReset,
}: SessionDoneStateProps) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("session");
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [reflection, setReflection] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState(false);

  const phaseMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.25, ease: "easeOut" as const },
        },
        exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
      };

  const maybeReflect = async () => {
    if (!sessionId) return;
    setReflecting(true);
    try {
      const access = await fetchCoachAccess();
      if (access.mode !== "PREMIUM") return;
      const res = await requestSessionReflection(sessionId);
      if (res.reflection) setReflection(res.reflection);
    } catch {
      /* Free / AI disabled / network — stay silent (§4 #5). */
    } finally {
      setReflecting(false);
    }
  };

  const handleSave = async () => {
    if (mood == null || status === "saving") return;
    setStatus("saving");
    try {
      await onSubmitFeedback(mood, note.trim() ? note.trim() : undefined);
      setStatus("saved");
      void maybeReflect();
    } catch {
      setStatus("idle");
    }
  };

  return (
    <motion.div
      className="flex w-full flex-col items-center gap-6 text-center"
      {...phaseMotion}
    >
      <span
        className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
          fontFamily: "var(--font-body)",
        }}
      >
        {t("done_chip")}
      </span>
      <p
        className="text-xl font-bold"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {t("done_title")}
      </p>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("done_elapsed", { minutes: Math.floor(focusElapsed / 60) })}
      </p>

      {status === "saved" ? (
        <div className="flex w-full flex-col items-center gap-4">
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--color-main)" }}
            role="status"
          >
            {t("checkin_saved")}
          </p>
          {reflecting && (
            <p
              className="text-sm"
              style={{ color: "var(--color-secondary)" }}
              role="status"
            >
              {t("reflection_loading")}
            </p>
          )}
          {reflection && (
            <PuhuCoachBubble
              message={reflection}
              variant="encouraging"
              dismissible
              className="flex w-full flex-col items-center"
              dismissLabel={t("reflection_dismiss")}
            />
          )}
        </div>
      ) : (
        <div className="flex w-full flex-col items-center gap-4">
          <p
            className="text-sm font-semibold"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("checkin_title")}
          </p>
          <div className="flex justify-center gap-3">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value)}
                aria-pressed={mood === m.value}
                aria-label={t(m.labelKey)}
                title={t(m.labelKey)}
                className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border text-2xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor:
                    mood === m.value
                      ? "var(--color-main)"
                      : "var(--color-progress-track)",
                  boxShadow:
                    mood === m.value ? "var(--shadow-card)" : undefined,
                }}
              >
                <span aria-hidden>{m.emoji}</span>
              </button>
            ))}
          </div>

          {mood != null && (
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
                onChange={(e) => setNote(e.target.value)}
                maxLength={280}
                placeholder={
                  subject
                    ? t("checkin_note_subject", { subject })
                    : t("checkin_note_placeholder")
                }
                className="w-full rounded-[var(--radius-card)] border bg-white/60 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2"
                style={{
                  borderColor: "var(--color-progress-track)",
                  color: "var(--color-main)",
                }}
              />
              <Button onClick={() => void handleSave()} busy={status === "saving"} fullWidth>
                {t("checkin_save")}
              </Button>
            </motion.div>
          )}
        </div>
      )}

      <div className="flex w-full flex-col gap-3">
        <Button
          onClick={onReset}
          variant={status === "saved" ? "primary" : "secondary"}
          fullWidth
        >
          {t("new_session")}
        </Button>
        <Link
          href="/panel"
          className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("back_panel")}
        </Link>
      </div>
    </motion.div>
  );
}
