"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AdPlacementId, type ExamType, type AdQuestionContext } from "@mentor/types";
import type { AdBlogListContext } from "@mentor/validation";
import { useAuth } from "@/lib/auth-context";
import { fetchAdPlacement, fetchPublicAdPlacement } from "@/lib/ads";
import { onSubscriptionChanged } from "@/lib/subscription-events";
import { configureLimitedPrivacy, withGpt, type GptEvent, type GptSlot } from "@/lib/google-publisher-tag";

const DISPLAY_TIMEOUT_MS = 10_000;

export interface ContextualAdSlotProps {
  placementId?: AdPlacementId;
  contentSlug?: string;
  examType?: ExamType;
  blogList?: AdBlogListContext;
  question?: AdQuestionContext;
}

/** Mounted by the deferred boundary only when it approaches the viewport. */
export function ContextualAdSlot({
  placementId = AdPlacementId.KNOWLEDGE_ARTICLE_END,
  contentSlug,
  examType,
  blogList,
  question,
}: ContextualAdSlotProps) {
  const questionId = question?.questionId;
  const contentRevision = question?.contentRevision;
  const family = blogList?.family;
  const category = blogList?.category;
  const page = blogList?.page;
  const { status, user } = useAuth();
  const t = useTranslations("ads");
  const reactId = useId();
  const slotId = `mentor-ad-${reactId.replaceAll(":", "")}`;
  const stopCurrent = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLElement>(null);
  const [revision, setRevision] = useState(0);
  const [renderState, setRenderState] = useState<"loading" | "filled" | "empty">("loading");
  const canRequest = status === "authenticated" ||
    (status === "anonymous" && (placementId === AdPlacementId.KNOWLEDGE_ARTICLE_END || placementId === AdPlacementId.KNOWLEDGE_INDEX || placementId === AdPlacementId.FORUM_QUESTION_END));

  useEffect(() => {
    const invalidate = () => {
      // Cancel pending callbacks immediately, before the next React effect.
      stopCurrent.current?.();
      setRenderState("empty");
      setRevision((value) => value + 1);
    };
    return onSubscriptionChanged(invalidate);
  }, []);

  useEffect(() => {
    if (!canRequest) return;
    let cancelled = false;
    let slot: GptSlot | null = null;
    let removeRenderListener: (() => void) | null = null;
    const stop = () => {
      cancelled = true;
      clearTimeout(timeout);
      removeRenderListener?.();
      removeRenderListener = null;
      if (slot) window.googletag?.destroySlots([slot]);
      slot = null;
    };
    const timeout = setTimeout(() => { stop(); setRenderState("empty"); }, DISPLAY_TIMEOUT_MS);
    stopCurrent.current = stop;
    const listContext = family ? { family, category, page: page ?? 1 } : undefined;
    const questionContext = questionId && contentRevision ? { questionId, contentRevision } : undefined;
    void (status === "authenticated"
      ? fetchAdPlacement(placementId, contentSlug, listContext, questionContext)
      : fetchPublicAdPlacement(placementId, contentSlug, examType, listContext, questionContext))
      .then(async (policy) => {
        if (cancelled) return;
        if (!policy.enabled || !policy.adUnitPath) {
          clearTimeout(timeout);
          setRenderState("empty");
          return;
        }
        const availableWidth = containerRef.current?.parentElement?.clientWidth ?? 0;
        const sizes = policy.sizes.filter(([width]) => width <= availableWidth);
        if (sizes.length === 0) { clearTimeout(timeout); setRenderState("empty"); return; }
        setRenderState("loading");
        await withGpt((gpt) => {
          if (cancelled) return;
          configureLimitedPrivacy(gpt, policy.audienceTreatment);
          const pubads = gpt.pubads();
          slot = gpt.defineSlot(policy.adUnitPath!, sizes, slotId)?.addService(pubads) ?? null;
          if (!slot) { clearTimeout(timeout); setRenderState("empty"); return; }
          const onRender = (event: GptEvent) => {
            if (event.slot !== slot || cancelled) return;
            clearTimeout(timeout);
            setRenderState(event.isEmpty === false ? "filled" : "empty");
          };
          pubads.addEventListener("slotRenderEnded", onRender);
          removeRenderListener = () => pubads.removeEventListener("slotRenderEnded", onRender);
          gpt.enableServices();
          gpt.display(slotId);
        });
      })
      .catch(() => { if (!cancelled) { stop(); setRenderState("empty"); } });
    return stop;
  }, [canRequest, category, contentRevision, contentSlug, examType, family, page, placementId, questionId, slotId, status, user, revision]);

  return (
    <aside ref={containerRef} aria-label={t("label")} className={!canRequest || renderState === "empty" ? "hidden" : "my-4 flex flex-col items-center"}>
      <span className="mb-1 rounded-[var(--radius-card)] bg-[var(--color-surface)] px-2 text-micro uppercase tracking-widest text-[var(--color-main)]">{t("label")}</span>
      {/* Display inventory is at most 250px high, including the overview squares. */}
      <div id={slotId} className="min-h-[250px] max-w-full overflow-hidden" />
    </aside>
  );
}
