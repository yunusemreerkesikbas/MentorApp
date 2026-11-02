"use client";

import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { useTranslations } from "next-intl";
import { CoachChatBackdrop } from "./coach-chat-backdrop";

const hairline = "color-mix(in srgb, var(--color-main) 8%, transparent)";

/**
 * Koç chat loading layout. Mirrors CoachChatShell's new-chat landing: history rail (desktop),
 * greeting + Puhu, starter chips, composer card and disclaimer, on the same pastel backdrop.
 */
export function CoachChatSkeleton() {
  const t = useTranslations("coach");

  return (
    <div className="relative flex h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom))] w-full overflow-hidden lg:h-screen">
      {/* Outside the group so the backdrop does not fade in and flash when the page swaps in. */}
      <CoachChatBackdrop />
      <SkeletonGroup label={t("loading")} className="relative z-[1] flex min-h-0 w-full">

      {/* History rail: title row, new chat, memory, recent chats. */}
      <div
        className="relative z-[1] hidden h-full w-72 shrink-0 flex-col border-r bg-[color-mix(in_srgb,var(--color-surface)_85%,transparent)] backdrop-blur-md lg:flex"
        style={{ borderColor: hairline }}
      >
        <div className="flex items-center gap-2 border-b px-4 py-4" style={{ borderColor: hairline }}>
          <Skeleton className="h-5 w-28 rounded-[var(--radius-card)]" />
          <Skeleton className="ml-auto size-9 rounded-full" />
        </div>
        <div className="flex flex-col gap-2 p-3">
          {["w-24", "w-32"].map((width) => (
            <div key={width} className="flex min-h-10 items-center gap-2.5 px-2.5">
              <Skeleton className="size-[18px] rounded-[6px]" />
              <Skeleton className={`h-4 ${width} rounded-[var(--radius-card)]`} />
            </div>
          ))}
          <Skeleton className="mx-2 mt-1 h-3 w-20 rounded-[var(--radius-card)]" />
          {["w-4/5", "w-3/4", "w-2/3", "w-4/5", "w-3/5", "w-3/4"].map((width, i) => (
            <div key={i} className="flex min-h-10 items-center px-2.5">
              <Skeleton className={`h-4 ${width} rounded-[var(--radius-card)]`} />
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Phone: the round history button. */}
        <div className="mx-auto flex w-full max-w-2xl shrink-0 px-5 pt-4 pb-1 lg:hidden">
          <Skeleton className="size-11 rounded-full" />
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center px-5 pt-5 pb-1 lg:pt-21">
          <Skeleton className="h-6 w-52 rounded-[var(--radius-card)] sm:h-7" />
          <Skeleton className="mt-2 h-6 w-72 max-w-full rounded-[var(--radius-card)] sm:h-7" />
          <div className="flex flex-1 items-center py-2">
            <Skeleton className="h-32 w-36 rounded-full" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-2xl shrink-0">
          <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2 px-5 pb-2">
            {["w-[140px]", "w-[168px]", "w-[158px]", "w-[166px]"].map((width, i) => (
              <Skeleton key={i} className={`h-9 ${width} rounded-full`} />
            ))}
          </div>
          <div className="px-5 pt-1 pb-2">
            <div
              className="rounded-[18px] bg-[var(--color-surface)] px-2.5 py-2 shadow-[var(--shadow-card)]"
              style={{ border: "1px solid color-mix(in srgb, var(--color-main) 6%, transparent)" }}
            >
              <div className="flex items-center gap-2 pt-1.5">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-4 w-40 rounded-[var(--radius-card)]" />
              </div>
              <div className="mt-0.5 flex justify-end">
                <Skeleton className="size-9 rounded-full" />
              </div>
            </div>
            <div className="mt-1.5 flex flex-col items-center gap-1">
              <Skeleton className="h-2.5 w-64 max-w-full rounded-[var(--radius-card)]" />
              <Skeleton className="h-2.5 w-80 max-w-full rounded-[var(--radius-card)]" />
            </div>
          </div>
        </div>
      </div>
      </SkeletonGroup>
    </div>
  );
}
