"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ExamType } from "@mentor/types";

const ContextualAdSlot = dynamic(() =>
  import("./contextual-ad-slot").then((module) => module.ContextualAdSlot),
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
    <div ref={boundary} className="min-h-px">
      {nearViewport ? <ContextualAdSlot contentSlug={contentSlug} examType={examType} /> : null}
    </div>
  );
}
