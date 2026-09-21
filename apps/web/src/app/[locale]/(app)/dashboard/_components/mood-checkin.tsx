"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { MoodCheckinDto, MoodReflectionDto } from "@mentor/types";
import {
  aiMoodControllerReflect,
  ApiClientError,
  coachingControllerUpsertMood,
} from "@mentor/api-client";
import { useCelebrationOverlay } from "@/lib/celebration-overlay";
import { isCelebrationOverlayBlocking } from "@/lib/celebration-queue";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { useSubscription } from "@/lib/subscription-context";
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
  const { ready: celebrationsReady, active: celebrationActive } =
    useCelebrationOverlay();
  const celebrationBlocking = isCelebrationOverlayBlocking(
    celebrationsReady,
    celebrationActive,
  );
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [message, setMessage] = useState<string | null>(initial?.message ?? null);
  const [note, setNote] = useState<string>(initial?.struggleNote ?? "");
  const [reflection, setReflection] = useState<string | null>(
    initial?.aiReflection ?? null,
  );
  const [reflecting, setReflecting] = useState(false);
  const [speechModalOpen, setSpeechModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoPromptAttemptedRef = useRef(false);
  const reflectRequestIdRef = useRef(0);
  const pageHydratedReflectRef = useRef(false);

  const generateReflection = useCallback(async () => {
    const requestId = ++reflectRequestIdRef.current;
    setReflecting(true);
    setReflection(null);
    try {
      const res = (await aiMoodControllerReflect()) as unknown as
        | { data?: MoodReflectionDto }
        | MoodReflectionDto;
      if (requestId !== reflectRequestIdRef.current) return;
      const dto =
        (res as { data?: MoodReflectionDto }).data ??
        (res as MoodReflectionDto);
      if (dto?.reflection) setReflection(dto.reflection);
    } catch {
      /* Fall back to the rule-based message; reflection is a premium enhancement. */
    } finally {
      if (requestId === reflectRequestIdRef.current) {
        setReflecting(false);
      }
    }
  }, []);

  useEffect(() => {
    // Sync the latest `initial` prop into local state — a deliberate external-sync, not derived state.
    /* eslint-disable react-hooks/set-state-in-effect */
    setMood(initial?.mood ?? null);
    setMessage(initial?.message ?? null);
    setNote(initial?.struggleNote ?? "");
    // Only adopt a server AI note; never wipe a local reflection with a null initial.
    if (initial?.aiReflection) {
      setReflection(initial.aiReflection);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initial]);

  const { view, loading: subscriptionLoading, refresh } = useSubscription();
  // Derived, not stored: `null` while the shared entitlement read is still settling, which is what
  // the lock and the "expect an AI note" branch below both key off.
  const reflectionAvailable: boolean | null = subscriptionLoading
    ? null
    : isPremiumFeatureAvailable(view, "mood.reflection");

  useEffect(() => {
    // One page-load hydrate when today's mood exists but the AI note was never fetched.
    if (
      reflectionAvailable !== true ||
      pageHydratedReflectRef.current ||
      initial?.mood == null ||
      initial.aiReflection != null
    ) {
      return;
    }
    pageHydratedReflectRef.current = true;
    void generateReflection();
  }, [
    generateReflection,
    initial?.aiReflection,
    initial?.mood,
    reflectionAvailable,
  ]);

  const resolveReflectionAvailable = useCallback(async () => {
    if (reflectionAvailable != null) return reflectionAvailable;
    // Saving before the shared read settled: join the request already in flight rather than
    // deciding "no reflection" on a value nobody has yet.
    return isPremiumFeatureAvailable(await refresh(), "mood.reflection");
  }, [reflectionAvailable, refresh]);

  const saveMood = useCallback(
    async (value: number, struggleNote: string) => {
      setBusy(true);
      try {
        const canReflect = await resolveReflectionAvailable();
        const result = (await coachingControllerUpsertMood({
          mood: value,
          struggleNote: struggleNote.trim() || undefined,
        })) as unknown as MoodCheckinDto;
        setMood(result.mood);
        setMessage(result.message);
        setReflection(null);
        pageHydratedReflectRef.current = true;
        if (canReflect) {
          // Shimmer before onSaved/parent re-render can flash the rule message.
          setReflecting(true);
        }
        onSaved?.(result);
        if (canReflect) {
          void generateReflection();
        }
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
    [
      generateReflection,
      onSaved,
      resolveReflectionAvailable,
      showErrorToast,
      tCommon,
    ],
  );

  const pickMood = useCallback(
    async (value: number) => {
      const saved = await saveMood(value, note);
      if (saved) {
        dialog.dismiss();
        setSpeechModalOpen(true);
      }
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
    /* Journey/achievement cinematics share the first paint; wait so the wheel does not stack. */
    if (celebrationBlocking) return;

    const mayAutoPrompt =
      MOOD_PROMPT_MODE === "mandatory"
        ? true
        : shouldAutoPromptMood(false);

    if (!mayAutoPrompt) return;

    autoPromptAttemptedRef.current = true;
    openMoodDialog();
  }, [celebrationBlocking, mood, openMoodDialog]);

  const expectAiReflection = reflectionAvailable === true;
  const speechLoading = expectAiReflection && reflecting;
  // Premium: never stream the rule fallback first. Free / AI failure: rule message.
  const speechText = speechLoading ? null : (reflection ?? message);

  return {
    mood,
    message,
    reflection,
    reflecting,
    speechLoading,
    speechText,
    reflectionLocked:
      reflectionAvailable === false && mood != null && reflection == null,
    openMoodDialog: () => openMoodDialog(),
    needsMoodToday: mood == null,
    speechModalOpen: speechModalOpen && !celebrationBlocking,
    openSpeechModal: () => setSpeechModalOpen(true),
    closeSpeechModal: () => setSpeechModalOpen(false),
  };
}
