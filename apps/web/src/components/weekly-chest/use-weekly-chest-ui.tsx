"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { WeeklyChestView } from "@mentor/types";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { writeNoticeMemory } from "@/lib/weekly-chest";
import { ChestInfoSheet } from "./chest-info-sheet";

// Own Suspense boundary (see panel-shell's overlays): the panel never blinks while the chunk loads.
const ChestScene = dynamic(() => import("./chest-scene").then((module) => module.ChestScene), { ssr: false });

const CLIP = "/visuals/chest/chest-open.mp4";
/** `/dashboard?chest=open` (the "Aç" on the toast elsewhere) opens a ready chest's scene on arrival. */
export const CHEST_OPEN_PARAM = "chest";

/**
 * The panel's way into the chest: a running week opens the info sheet, a ready or opened chest the
 * scene. Seeing a ready chest here also counts as hearing about it, so the app-wide toast stays quiet.
 */
export function useWeeklyChestUi(chest: WeeklyChestView | null, onChanged: () => void) {
  const t = useTranslations("weeklyChest");
  const sheet = useMentorBottomSheet();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [scene, setScene] = useState<WeeklyChestView | null>(null);

  const openChest = useCallback(
    (view: WeeklyChestView) => {
      if (view.state === "PROGRESS") {
        sheet.show({ title: t("title"), layout: "filter", bodyScroll: true, children: <ChestInfoSheet chest={view} /> });
        return;
      }
      setScene(view);
    },
    [sheet, t],
  );

  const ready = chest?.state === "READY" ? chest : null;
  useEffect(() => {
    if (ready && user?.id) writeNoticeMemory(user.id, { noticed: ready.periodKey });
  }, [ready, user?.id]);

  const deepLinked = useRef(false);
  const wantsOpen = searchParams.get(CHEST_OPEN_PARAM) === "open";
  useEffect(() => {
    if (!wantsOpen || deepLinked.current || !chest) return;
    deepLinked.current = true;
    router.replace("/dashboard", { scroll: false });
    // A ready chest only: an already opened one has nothing new to show from a toast. One-shot
    // reaction to arriving from a link (the URL is cleaned above), like the panel's mock previews.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (chest.state === "READY") setScene(chest);
  }, [chest, router, wantsOpen]);

  const overlay = (
    <>
      {/* Warm the clip while the chest waits, so the lid opens without a stall. */}
      {ready ? <link rel="prefetch" href={CLIP} as="video" /> : null}
      {scene ? (
        <ChestScene
          chest={scene}
          onClose={(opened) => {
            setScene(null);
            if (opened) onChanged();
          }}
        />
      ) : null}
    </>
  );

  return { openChest, overlay };
}
