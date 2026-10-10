"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ExamType } from "@mentor/types";
import { useAdvertisingConsent } from "@/lib/advertising-consent";

const ContextualAdSlot = dynamic(
  () => import("./contextual-ad-slot").then((module) => module.ContextualAdSlot),
  { loading: () => <div aria-hidden className="my-4 min-h-[100px]" /> },
);

/** Keep ad policy and Google tag code off the initial article path. */
export function DeferredContextualAdSlot({
  contentSlug,
  examType,
}: {
  contentSlug: string;
  examType: ExamType;
}) {
  const boundary = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const { consent } = useAdvertisingConsent();

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
    <div ref={boundary} className={consent === "accepted" && !nearViewport ? "min-h-[100px]" : "min-h-px"}>
      {nearViewport && consent === "accepted" ? <ContextualAdSlot contentSlug={contentSlug} examType={examType} /> : null}
    </div>
  );
}
