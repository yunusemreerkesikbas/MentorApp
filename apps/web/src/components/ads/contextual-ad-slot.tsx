"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AdPlacementId, type ExamType } from "@mentor/types";
import { useAuth } from "@/lib/auth-context";
import { useAdvertisingConsent } from "@/lib/advertising-consent";
import { fetchAdPlacement, fetchPublicAdPlacement } from "@/lib/ads";
import { onSubscriptionChanged } from "@/lib/subscription-events";
import { configureLimitedPrivacy, withGpt, type GptEvent, type GptSlot } from "@/lib/google-publisher-tag";

const DISPLAY_TIMEOUT_MS = 10_000;

/** Mounted by the deferred boundary only when it approaches the viewport. */
export function ContextualAdSlot({
  placementId = AdPlacementId.KNOWLEDGE_ARTICLE_END,
  contentSlug,
  examType,
}: { placementId?: AdPlacementId; contentSlug: string; examType?: ExamType }) {
  const { status, user } = useAuth();
  const { consent } = useAdvertisingConsent();
  const t = useTranslations("ads");
  const reactId = useId();
  const slotId = `mentor-ad-${reactId.replaceAll(":", "")}`;
  const stopCurrent = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLElement>(null);
  const [revision, setRevision] = useState(0);
  const [renderState, setRenderState] = useState<"loading" | "filled" | "empty">("loading");

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
    if (status === "loading" || consent !== "accepted") return;
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
    void (status === "authenticated"
      ? fetchAdPlacement(placementId, contentSlug)
      : fetchPublicAdPlacement(placementId, contentSlug, examType))
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
  }, [contentSlug, examType, placementId, slotId, status, user, consent, revision]);

  return (
    <aside ref={containerRef} aria-label={t("label")} className={status === "loading" || consent !== "accepted" || renderState === "empty" ? "hidden" : "my-4 flex flex-col items-center"}>
      <span className="mb-1 text-micro uppercase tracking-widest text-[var(--color-secondary)]">{t("label")}</span>
      {/* Reserve the maximum declared Google inventory height (320x100 / 728x90). */}
      <div id={slotId} className="min-h-[100px] max-w-full overflow-hidden" />
    </aside>
  );
}
