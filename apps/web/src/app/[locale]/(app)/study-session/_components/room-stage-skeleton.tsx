"use client";

import type { CSSProperties } from "react";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { useTranslations } from "next-intl";

/** Seat slots around the table, as a share of the square stage (the four-seat layout). */
const SEATS = [
  { left: "50%", top: "12%" },
  { left: "93%", top: "50%" },
  { left: "50%", top: "88%" },
  { left: "7%", top: "50%" },
] as const;

/**
 * Bones in the room's own ink: faint light blocks on the dark ground, like the chrome that
 * follows. The kit's shimmer paints a gradient from these two tokens (an unlayered `background`,
 * so a `bg-` class cannot win), which is why the tokens are what change here.
 */
const BONE_TOKENS = {
  ["--color-surface-container" as string]: "color-mix(in srgb, var(--room-ink) 14%, transparent)",
  ["--color-surface" as string]: "color-mix(in srgb, var(--room-ink) 24%, transparent)",
} as CSSProperties;

/**
 * The table while it loads: the same stage frame the room paints into (ground, header row,
 * table, chairs, the pinned action), so the swap moves nothing. It was an empty screen. The
 * theme is not known yet, so the ground is the default room's.
 */
export function RoomStageSkeleton() {
  const t = useTranslations("session_room");

  return (
    <main
      className="room-stage relative flex min-h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom))] flex-col overflow-hidden lg:min-h-screen"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 8%, var(--room-ground-from) 0%, var(--room-ground-to) 100%)",
      }}
    >
      <SkeletonGroup label={t("loading_room")} className="relative flex flex-1 flex-col" style={BONE_TOKENS}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5 lg:px-8">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-4 w-28 rounded-full" />
          </div>
          <Skeleton className="size-11 rounded-full" />
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-5 pb-28 pt-4 lg:pb-32">
          <div className="relative mx-auto aspect-[3/4] max-h-full min-h-0 w-full sm:aspect-square sm:max-w-[min(46rem,78vh)]">
            <Skeleton className="absolute left-[20%] top-[28%] h-[44%] w-[60%] rounded-[50%]" />
            {SEATS.map((seat, index) => (
              <Skeleton
                key={index}
                className="absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full sm:size-20 lg:size-24"
                style={{ left: seat.left, top: seat.top }}
              />
            ))}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-center px-5 pb-6 lg:pb-10">
          <Skeleton className="h-[3.25rem] w-full max-w-sm rounded-full" />
        </div>
      </SkeletonGroup>
    </main>
  );
}
