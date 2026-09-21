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
import { useMentorToast } from "@/lib/mentor-toast";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { useSubscription } from "@/lib/subscription-context";

type UseMoodCheckinOptions = {
  initial: MoodCheckinDto | null;
  onSaved?: (result: MoodCheckinDto) => void;
};

/**
 * Daily mood check-in: one tap on the greeting row saves it, then Puhu answers — the premium AI
 * reflection, or the rule-based line for everyone else.
 *
 * The wheel that opened itself on every visit is gone (2026-09-21). It offered the same five moods
 * the row now shows in place, so the modal was the same question asked twice.
 */
export function useMoodCheckin({ initial, onSaved }: UseMoodCheckinOptions) {
  const tCommon = useTranslations("common");
  const { error: showErrorToast } = useMentorToast();
  const { ready: celebrationsReady, active: celebrationActive } =
    useCelebrationOverlay();
  const celebrationBlocking = isCelebrationOverlayBlocking(
    celebrationsReady,
    celebrationActive,
  );
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [message, setMessage] = useState<string | null>(initial?.message ?? null);
  const [reflection, setReflection] = useState<string | null>(
    initial?.aiReflection ?? null,
  );
  const [reflecting, setReflecting] = useState(false);
  const [speechModalOpen, setSpeechModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
    // Only adopt a server AI note; never wipe a local reflection with a null initial.
    if (initial?.aiReflection) {
      setReflection(initial.aiReflection);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initial]);

  const { view, loading: subscriptionLoading, refresh } = useSubscription();
  // Derived, not stored: `null` while the shared entitlement read is still settling, which is what
  // the "expect an AI note" branch below keys off.
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

  // The row has no note field; a re-pick resends the note already saved so it is not wiped.
  const savedNote = initial?.struggleNote?.trim() || undefined;

  const pickMood = useCallback(
    async (value: number) => {
      if (busy) return;
      setBusy(true);
      try {
        const canReflect = await resolveReflectionAvailable();
        const result = (await coachingControllerUpsertMood({
          mood: value,
          struggleNote: savedNote,
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
        setSpeechModalOpen(true);
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
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      generateReflection,
      onSaved,
      savedNote,
      resolveReflectionAvailable,
      showErrorToast,
      tCommon,
    ],
  );

  const speechLoading = reflectionAvailable === true && reflecting;
  // Premium: never stream the rule fallback first. Free / AI failure: rule message.
  const speechText = speechLoading ? null : (reflection ?? message);

  return {
    mood,
    busy,
    pickMood,
    speechLoading,
    speechText,
    speechModalOpen: speechModalOpen && !celebrationBlocking,
    closeSpeechModal: () => setSpeechModalOpen(false),
  };
}
