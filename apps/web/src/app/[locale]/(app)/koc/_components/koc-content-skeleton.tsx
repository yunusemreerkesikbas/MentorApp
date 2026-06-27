"use client";

import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { useTranslations } from "next-intl";

/** Koç chat loading layout — mirrors header, bubbles, composer. */
export function KocChatSkeleton() {
  const t = useTranslations("koc");

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col lg:min-h-screen">
      <div className="px-5 pt-8">
        <Skeleton className="h-7 w-40 rounded-[var(--radius-card)]" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full rounded-[var(--radius-card)]" />
      </div>

      <SkeletonGroup
        label={t("loading")}
        className="flex flex-1 flex-col gap-3 px-5 py-6"
      >
        <KocBubbleSkeleton align="left" className="w-3/5" />
        <KocBubbleSkeleton align="right" className="w-2/5" />
        <KocBubbleSkeleton align="left" className="w-1/2" />
      </SkeletonGroup>

      <div className="border-t border-white px-5 py-3">
        <Skeleton className="h-11 w-full rounded-[var(--radius-card)]" />
      </div>
    </main>
  );
}

function KocBubbleSkeleton({
  align,
  className,
}: {
  align: "left" | "right";
  className?: string;
}) {
  return (
    <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
      <Skeleton className={`h-12 rounded-[var(--radius-card)] ${className ?? ""}`} />
    </div>
  );
}
