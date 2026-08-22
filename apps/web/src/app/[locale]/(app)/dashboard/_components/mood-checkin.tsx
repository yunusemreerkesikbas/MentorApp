"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { MoodCheckinDto, MoodReflectionDto } from "@mentor/types";
import {
  aiMoodControllerReflect,
  ApiClientError,
  coachingControllerUpsertMood,
} from "@mentor/api-client";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { fetchSubscriptionView } from "@/lib/subscription-view";
import { MOOD_WHEEL_OPTIONS } from "./mood-assets";
import {
  deferMoodPromptForToday,
  shouldAutoPromptMood,
} from "./mood-prompt-storage";
import { MoodWheelPicker } from "./mood-wheel-picker";

/**
 * soft — auto-prompt at most once per calendar day when today's mood is unset;
 *        "Daha sonra" / backdrop / Esc snooze until tomorrow (localStorage).
 * mandatory — auto-prompt on each panel visit until mood is saved; modal cannot be dismissed.
 */
const MOOD_PROMPT_MODE: "soft" | "mandatory" = "soft";

type UseMoodCheckinOptions = {
  initial: MoodCheckinDto | null;
  onSaved?: (result: MoodCheckinDto) => void;
};

/**
 * Daily mood check-in — modal wheel + backend upsert.
 * Hero "Ruh hali" tile opens manually any time; auto-prompt follows MOOD_PROMPT_MODE.
 */
export function useMoodCheckin({ initial, onSaved }: UseMoodCheckinOptions) {
  const t = useTranslations("mood");
  const tCommon = useTranslations("common");
  const { error: showErrorToast } = useMentorToast();
  const dialog = useMentorDialog();
  const [reflectionAvailable, setReflectionAvailable] = useState<boolean | null>(
    null,
  );
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [message, setMessage] = useState<string | null>(initial?.message ?? null);
  const [note, setNote] = useState<string>(initial?.struggleNote ?? "");
  const [reflection, setReflection] = useState<string | null>(
    initial?.aiReflection ?? null,
  );
  const [reflecting, setReflecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoPromptAttemptedRef = useRef(false);

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
      /* Fall back to the rule-based message; reflection is a premium enhancement. */
    } finally {
      setReflecting(false);
    }
  }, []);

  useEffect(() => {
    // Sync the latest `initial` prop into local state — a deliberate external-sync, not derived state.
    /* eslint-disable react-hooks/set-state-in-effect */
    setMood(initial?.mood ?? null);
    setMessage(initial?.message ?? null);
    setNote(initial?.struggleNote ?? "");
    setReflection(initial?.aiReflection ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initial]);

  useEffect(() => {
    let active = true;
    fetchSubscriptionView().then((view) => {
      if (!active) return;
      const available = isPremiumFeatureAvailable(view, "mood.reflection");
      setReflectionAvailable(available);
      if (available && initial?.mood != null && initial.aiReflection == null) {
        void generateReflection();
      }
    });
    return () => {
      active = false;
    };
  }, [generateReflection, initial?.aiReflection, initial?.mood]);

  const saveMood = useCallback(
    async (value: number, struggleNote: string) => {
      setBusy(true);
      try {
        const result = (await coachingControllerUpsertMood({
          mood: value,
          struggleNote: struggleNote.trim() || undefined,
        })) as unknown as MoodCheckinDto;
        setMood(result.mood);
        setMessage(result.message);
        setReflection(null);
        if (reflectionAvailable) await generateReflection();
        onSaved?.(result);
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
    },
    [generateReflection, onSaved, reflectionAvailable, showErrorToast, tCommon],
  );

  const pickMood = useCallback(
    async (value: number) => {
      const saved = await saveMood(value, note);
      if (saved) dialog.dismiss();
    },
    [dialog, note, saveMood],
  );

  const openMoodDialog = useCallback(
    () => {
      const isMandatory = MOOD_PROMPT_MODE === "mandatory";

      if (MOOD_PROMPT_MODE === "soft" && mood == null) {
        deferMoodPromptForToday();
      }

      dialog.show({
        title: t("title"),
        layout: "promo",
        dismissOnBackdrop: !isMandatory,
        dismissOnEscape: !isMandatory,
        content: (
          <MoodWheelPicker
            value={mood}
            options={MOOD_WHEEL_OPTIONS}
            getLabel={(value) =>
              t(
                `option_${value}` as
                  | "option_1"
                  | "option_2"
                  | "option_3"
                  | "option_4"
                  | "option_5",
              )
            }
            onSelect={(value) => void pickMood(value)}
            confirmLabel={t("checkin_cta")}
            hintLabel={t("wheel_hint")}
            laterLabel={isMandatory ? undefined : t("ask_later")}
            onLater={
              isMandatory
                ? undefined
                : () => {
                    deferMoodPromptForToday();
                    dialog.dismiss();
                  }
            }
            disabled={busy}
            ariaLabel={t("title")}
          />
        ),
        actions: [],
      });
    },
    [busy, dialog, mood, pickMood, t],
  );

  useEffect(() => {
    if (mood != null || autoPromptAttemptedRef.current) return;

    const mayAutoPrompt =
      MOOD_PROMPT_MODE === "mandatory"
        ? true
        : shouldAutoPromptMood(false);

    if (!mayAutoPrompt) return;

    autoPromptAttemptedRef.current = true;
    openMoodDialog();
  }, [mood, openMoodDialog]);

  return {
    mood,
    message,
    reflection,
    reflecting,
    reflectionLocked:
      reflectionAvailable === false && mood != null && reflection == null,
    openMoodDialog: () => openMoodDialog(),
    needsMoodToday: mood == null,
  };
}
