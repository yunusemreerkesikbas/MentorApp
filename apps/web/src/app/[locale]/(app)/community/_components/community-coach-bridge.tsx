"use client";

import { useEffect } from "react";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import { useLocale, useTranslations } from "next-intl";
import type { ForumCoachBridgeView } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { PuhuImage } from "@/components/puhu-image";
import { communityCoachDraft } from "@/lib/community-coach-bridge";
import { trackCommunityEvent } from "@/lib/analytics";

export function CommunityCoachBridge({ bridge }: { bridge: ForumCoachBridgeView | null | undefined }) {
  const locale = useLocale();
  const t = useTranslations("community.coach_bridge");

  useEffect(() => {
    if (!bridge || (bridge.zone.type !== "CHAT" && bridge.zone.type !== "QA")) return;
    trackCommunityEvent("forum_coach_bridge_impression", {
      zone_type: bridge.zone.type,
      intent: bridge.intent,
    });
  }, [bridge]);

  if (!bridge || (bridge.zone.type !== "CHAT" && bridge.zone.type !== "QA")) return null;
  const zoneType = bridge.zone.type;

  return (
    <div className="mt-4 flex w-full flex-col gap-3 rounded-[13px] border border-[color:color-mix(in_srgb,var(--community-blue)_42%,white)] bg-[color:color-mix(in_srgb,var(--community-blue)_10%,white)] p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_4px_rgb(20_40_80_/_8%)]">
          <PuhuImage variant="encouraging" size={34} />
        </span>
        <div className="min-w-0 text-sm font-bold text-[#26364d]">
          <span className="truncate">#{bridge.tag.name}</span>
          <span className="mx-2 text-[#8c98a8]" aria-hidden>·</span>
          <span className="font-semibold text-[#617086]">{bridge.zone.title}</span>
        </div>
      </div>
      <Link
        href={{
          pathname: "/coach/chat",
          query: {
            seed: communityCoachDraft(bridge.intent, locale),
            contextCommunityThreadId: bridge.threadId,
          },
        }}
        onClick={() => trackCommunityEvent("forum_coach_bridge_click", {
          zone_type: zoneType,
          intent: bridge.intent,
        })}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--community-blue)] px-4 text-sm font-extrabold text-white transition-colors hover:bg-[var(--community-blue-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none sm:w-auto"
      >
        {t(bridge.intent)}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
