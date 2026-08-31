"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AdPlacementId, type ExamType } from "@mentor/types";
import { useAuth } from "@/lib/auth-context";
import { fetchAdPlacement, fetchPublicAdPlacement } from "@/lib/ads";
import { configureLimitedPrivacy, withGpt, type GptEvent, type GptSlot } from "@/lib/google-publisher-tag";

const AD_LAZY_LOAD_ROOT_MARGIN = "300px";

export function ContextualAdSlot({
  placementId = AdPlacementId.KNOWLEDGE_ARTICLE_END,
  contentSlug,
  examType,
}: { placementId?: AdPlacementId; contentSlug: string; examType?: ExamType }) {
  const { status } = useAuth();
  const t = useTranslations("ads");
  const reactId = useId();
  const slotId = `mentor-ad-${reactId.replaceAll(":", "")}`;
  const containerRef = useRef<HTMLElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [renderState, setRenderState] = useState<"idle" | "loading" | "filled" | "empty">("idle");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: AD_LAZY_LOAD_ROOT_MARGIN },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport || status === "loading") return;
    let cancelled = false;
    let slot: GptSlot | null = null;
    let removeRenderListener: (() => void) | null = null;
    void (status === "authenticated"
      ? fetchAdPlacement(placementId, contentSlug)
      : fetchPublicAdPlacement(placementId, contentSlug, examType))
      .then(async (policy) => {
        if (cancelled || !policy.enabled || !policy.adUnitPath) return;
        setRenderState("loading");
        await withGpt((gpt) => {
          if (cancelled) return;
          configureLimitedPrivacy(gpt, policy.audienceTreatment);
          const pubads = gpt.pubads();
          pubads.collapseEmptyDivs();
          slot = gpt.defineSlot(policy.adUnitPath!, policy.sizes, slotId)?.addService(pubads) ?? null;
          if (!slot) {
            setRenderState("empty");
            return;
          }
          const onRender = (event: GptEvent) => {
            if (event.slot === slot && !cancelled) setRenderState(event.isEmpty === false ? "filled" : "empty");
          };
          pubads.addEventListener("slotRenderEnded", onRender);
          removeRenderListener = () => pubads.removeEventListener("slotRenderEnded", onRender);
          gpt.enableServices();
          gpt.display(slotId);
        });
      })
      .catch(() => { if (!cancelled) setRenderState("empty"); });
    return () => {
      cancelled = true;
      removeRenderListener?.();
      if (slot && window.googletag) window.googletag.destroySlots([slot]);
    };
  }, [contentSlug, examType, nearViewport, placementId, slotId, status]);

  const hidden = renderState === "empty";
  const visible = renderState === "loading" || renderState === "filled";

  return (
    <aside
      ref={containerRef}
      aria-label={t("label")}
      className={
        hidden
          ? "hidden"
          : visible
            ? "my-4 flex flex-col items-center"
            : "my-4 min-h-px"
      }
    >
      <span className={renderState === "filled" ? "mb-1 text-[10px] uppercase tracking-widest text-[var(--color-secondary)]" : "sr-only"}>{t("label")}</span>
      <div id={slotId} className="min-h-[90px] max-w-full overflow-hidden" />
    </aside>
  );
}
