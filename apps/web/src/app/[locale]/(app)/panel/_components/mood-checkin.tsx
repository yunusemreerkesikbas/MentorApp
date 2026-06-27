"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type {
  CoachAccessDto,
  MoodCheckinDto,
  MoodReflectionDto,
} from "@mentor/types";
import {
  aiChatControllerGetAccess,
  aiMoodControllerReflect,
  ApiClientError,
  coachingControllerUpsertMood,
} from "@mentor/api-client";
import { Card, Chip, SectionHeading } from "@mentor/ui";
import { PuhuImage, type PuhuVariant } from "@/components/puhu-image";
import { useRouter } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";

const MOOD_OPTIONS: Array<{ value: number; variant: PuhuVariant }> = [
  { value: 1, variant: "surprised" },
  { value: 2, variant: "default" },
  { value: 3, variant: "encouraging" },
  { value: 4, variant: "happy" },
  { value: 5, variant: "proud" },
];

/**
 * Mood check-in — gentle daily prompt (plan §3 Slice 5 + W3 mood AI-adaptive layer).
 *
 * Free tier reads the rule-based, backend-localized encouragement verbatim (§4 #5). Premium users
 * additionally get an AI-adaptive reflection (`POST /v1/coach/mood-reflection`) and an optional
 * "zorlandığın konu" note that grounds it. The reflection is cached server-side per day, so a
 * re-fetch of an unchanged mood costs nothing.
 */
export function MoodCheckin({ initial }: { initial: MoodCheckinDto | null }) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("mood");
  const tCommon = useTranslations("common");
  const { error: showErrorToast } = useMentorToast();
  const dialog = useMentorDialog();
  const router = useRouter();
  const [premium, setPremium] = useState<boolean | null>(null);
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [message, setMessage] = useState<string | null>(
    initial?.message ?? null,
  );
  const [note, setNote] = useState<string>(initial?.struggleNote ?? "");
  const [reflection, setReflection] = useState<string | null>(
    initial?.aiReflection ?? null,
  );
  const [reflecting, setReflecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoPromptShownRef = useRef(false);

  const generateReflection = useCallback(async () => {
    setReflecting(true);
    try {
      const res = (await aiMoodControllerReflect()) as unknown as
        | { data?: MoodReflectionDto }
        | MoodReflectionDto;
      const dto =
        (res as { data?: MoodReflectionDto }).data ??
        (res as MoodReflectionDto);
      if (dto?.reflection) setReflection(dto.reflection);
    } catch {
      /* Fall back to the rule-based message; reflection is a premium enhancement, not critical. */
    } finally {
      setReflecting(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    aiChatControllerGetAccess()
      .then((res) => {
        if (!active) return;
        const access =
          (res as unknown as { data?: CoachAccessDto }).data ??
          (res as unknown as CoachAccessDto);
        const isPremium = access?.mode === "PREMIUM";
        setPremium(isPremium);
        // Fetch cached reflection on load when premium + mood set but no reflection yet.
        if (
          isPremium &&
          initial?.mood != null &&
          initial.aiReflection == null
        ) {
          void generateReflection();
        }
      })
      .catch(() => {
        if (active) setPremium(false);
      });
    return () => {
      active = false;
    };
  }, [generateReflection, initial?.aiReflection, initial?.mood]);

  const saveMood = useCallback(async (value: number, struggleNote: string) => {
    setBusy(true);
    try {
      const result = (await coachingControllerUpsertMood({
        mood: value,
        struggleNote: struggleNote.trim() || undefined,
      })) as unknown as MoodCheckinDto;
      setMood(result.mood);
      setMessage(result.message);
      setReflection(null); // mood/note changed → stale reflection cleared server-side too
      if (premium) await generateReflection();
      return true;
    } catch (err) {
      showErrorToast({
        title: tCommon("error_title"),
        message:
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
          : tCommon("error_unknown"),
        duration: 3000,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }, [generateReflection, premium, showErrorToast, tCommon]);

  const pickMood = useCallback(async (value: number) => {
    const saved = await saveMood(value, note);
    if (saved) dialog.dismiss();
  }, [dialog, note, saveMood]);

  const openMoodDialog = useCallback(() => {
    dialog.show({
      title: t("title"),
      message: t("subtitle"),
      dismissOnBackdrop: true,
      dismissOnEscape: true,
      content: (
        <div className={`grid grid-cols-5 gap-2 ${busy ? "pointer-events-none opacity-60" : ""}`} aria-busy={busy}>
          {MOOD_OPTIONS.map((option) => {
            const selected = mood === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                aria-label={t(`option_${option.value}`)}
                onClick={() => void pickMood(option.value)}
                className={[
                  "grid min-h-24 place-items-center gap-2 rounded-[var(--radius-card)] border p-2 text-xs font-bold transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-progress)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                  selected
                    ? "border-[var(--color-progress)] bg-[color-mix(in_srgb,var(--color-progress-track)_45%,white)]"
                    : "border-black/10 bg-white",
                ].join(" ")}
              >
                <PuhuImage variant={option.variant} size={48} />
                <span style={{ color: "var(--color-main)" }}>{t(`option_${option.value}`)}</span>
              </button>
            );
          })}
        </div>
      ),
      actions: [
        {
          id: "later",
          label: t("ask_later"),
          variant: "secondary",
        },
      ],
    });
  }, [busy, dialog, mood, pickMood, t]);

  useEffect(() => {
    if (mood != null || autoPromptShownRef.current) return;
    autoPromptShownRef.current = true;
    openMoodDialog();
  }, [mood, openMoodDialog]);

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-4">
          <SectionHeading subtitle={mood == null ? t("subtitle") : undefined}>
            {t("title")}
          </SectionHeading>
          <button
            type="button"
            onClick={openMoodDialog}
            className="shrink-0 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-progress-track)_45%,white)] px-3 py-2 text-sm font-bold text-[var(--color-progress)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-progress)]"
          >
            {mood == null ? t("checkin_cta") : t("change_cta")}
          </button>
        </div>

      {premium && mood != null ? (
        <label className="mt-4 flex flex-col gap-1.5">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--color-main)" }}
          >
            {t("struggle_label")}
          </span>
          <textarea
            value={note}
            maxLength={280}
            rows={2}
            disabled={busy}
            placeholder={t("struggle_placeholder")}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (mood != null && (note.trim() || initial?.struggleNote))
                void saveMood(mood, note);
            }}
            className="resize-none rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: "var(--color-border, #e2e2e2)",
              color: "var(--color-body)",
            }}
          />
        </label>
      ) : null}

      {reflecting ? (
        <p
          className="mt-4 text-sm"
          role="status"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("coach_thinking")}
        </p>
      ) : premium && reflection ? (
        <motion.div
          role="status"
          className="mt-4 flex flex-col gap-2"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Chip>{t("coach_chip")}</Chip>
          <p className="text-sm" style={{ color: "var(--color-body)" }}>
            {reflection}
          </p>
        </motion.div>
      ) : message ? (
        <motion.p
          role="status"
          className="mt-4 text-sm"
          style={{ color: "var(--color-body)" }}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {message}
        </motion.p>
      ) : null}

      {premium === false && mood != null ? (
        <button
          type="button"
          onClick={() => router.push("/abonelik")}
          className="mt-3 text-left text-sm underline"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("premium_nudge")}
        </button>
      ) : null}
      </Card>
    </>
  );
}
