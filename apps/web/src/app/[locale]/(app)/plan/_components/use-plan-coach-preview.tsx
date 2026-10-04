"use client";
import { useEffect, useRef, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import type {
  ApplyPlanAdaptationResultDto,
  CoachPlanAdaptationDto,
} from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { trackCoachEvent } from "@/lib/analytics";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorToast } from "@/lib/mentor-toast";
import { applyCoachPlanAdaptation } from "@/lib/plan-tasks";
import {
  PlanCoachAdaptationPreview,
  type PlanCoachAdaptationPreviewHandle,
} from "./plan-coach-adaptation-preview";

export function readCoachError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function usePlanCoachPreview({
  onApplied,
  onPlanChanged,
  onRegenerate,
  returnFocusRef,
}: {
  onApplied: (result: ApplyPlanAdaptationResultDto) => Promise<void>;
  onPlanChanged: () => Promise<void>;
  onRegenerate: (input: CoachPlanAdaptationInput) => void;
  returnFocusRef: RefObject<HTMLSpanElement | null>;
}) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const { filterSheet, dismissNow } = useMentorBottomSheet();
  const toast = useMentorToast();
  const previewRef = useRef<PlanCoachAdaptationPreviewHandle>(null);
  const previewOpen = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (previewOpen.current) dismissNow();
    };
  }, [dismissNow]);
  async function openPreview(
    preview: CoachPlanAdaptationDto,
    input: CoachPlanAdaptationInput,
  ) {
    if (!mounted.current || previewOpen.current) return;
    previewOpen.current = true;
    let settled = false;
    let replacing = false;
    const returnButton = returnFocusRef.current?.querySelector("button");
    try {
      const applied: { result: ApplyPlanAdaptationResultDto | null } = {
        result: null,
      };
      const regenerate = () => {
        replacing = true;
        dismissNow();
        queueMicrotask(() => onRegenerate(input));
      };
      const result = await filterSheet({
        title: t("coach_adaptation_preview_title"),
        applyLabel:
          preview.status === "READY"
            ? t("coach_adaptation_apply_selected")
            : t("coach_adaptation_close"),
        children: (
          <PlanCoachAdaptationPreview
            ref={previewRef}
            preview={preview}
            onRegenerate={regenerate}
          />
        ),
        onApply: async () => {
          if (preview.status === "NO_CHANGE") return;
          const changes = previewRef.current?.getSelectedChanges() ?? [];
          if (changes.length === 0) {
            previewRef.current?.setError(t("coach_adaptation_select_required"));
            throw new Error("validation");
          }
          try {
            applied.result = await applyCoachPlanAdaptation({
              planRevision: preview.planRevision,
              source: input.source,
              changes,
            });
          } catch (error) {
            const stale =
              error instanceof ApiClientError && error.status === 409;
            if (stale) await onPlanChanged();
            previewRef.current?.setError(
              readCoachError(error, tCommon("error_unknown")),
              stale,
            );
            throw error;
          }
        },
      });
      // The global sheet has finished; a slow refresh must not retain ownership of it.
      previewOpen.current = false;
      settled = true;
      if (mounted.current && !replacing && returnButton?.isConnected)
        returnButton.focus();
      if (!mounted.current || result !== "apply" || !applied.result) return;
      await onApplied(applied.result);
      if (!mounted.current) return;
      const moveCount = applied.result.moved.length;
      const addCount = applied.result.added.length;
      trackCoachEvent("coach_plan_adaptation_apply", {
        source: input.source,
        move_count: moveCount,
        add_count: addCount,
      });
      toast.success({
        title: t("coach_adaptation_success_title"),
        message: t("coach_adaptation_success_message", {
          moveCount,
          addCount,
        }),
        duration: 3000,
      });
    } catch (error) {
      if (mounted.current)
        toast.error({
          title: tCommon("error_title"),
          message: readCoachError(error, tCommon("error_unknown")),
          duration: 3000,
        });
    } finally {
      if (!settled) previewOpen.current = false;
    }
  }

  return openPreview;
}
