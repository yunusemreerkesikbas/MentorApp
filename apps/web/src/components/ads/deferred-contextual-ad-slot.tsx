"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AdPlacementId } from "@mentor/types";
import type { ContextualAdSlotProps } from "./contextual-ad-slot";

const ContextualAdSlot = dynamic(
  () => import("./contextual-ad-slot").then((module) => module.ContextualAdSlot),
  { loading: () => <div aria-hidden className="my-4 min-h-[250px]" /> },
);

/** Keep ad policy and Google tag code off the initial content path. */
export function DeferredContextualAdSlot({
  placementId = AdPlacementId.KNOWLEDGE_ARTICLE_END,
  contentSlug,
  examType,
  blogList,
  question,
  className = "",
}: ContextualAdSlotProps & { className?: string }) {
  const boundary = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const target = boundary.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "300px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={boundary}
      data-ad-placement={placementId}
      className={`${!nearViewport && placementId === AdPlacementId.KNOWLEDGE_ARTICLE_END ? "min-h-[250px]" : "min-h-px"} ${className}`}
    >
      {nearViewport ? <ContextualAdSlot placementId={placementId} contentSlug={contentSlug} examType={examType} blogList={blogList} question={question} /> : null}
    </div>
  );
}
