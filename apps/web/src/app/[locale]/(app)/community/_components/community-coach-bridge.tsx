"use client";
import { ArrowRight } from "lucide-react";

import { useEffect } from "react";
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
    <div className="mx-3 my-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--radius-card)] border border-[color:color-mix(in_srgb,var(--community-blue)_26%,white)] bg-[color:color-mix(in_srgb,var(--community-blue)_7%,white)] px-3 py-2.5 sm:gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white sm:size-9">
          <PuhuImage variant="encouraging" size={26} />
        </span>
        <div className="min-w-0 truncate whitespace-nowrap text-xs font-bold text-[#26364d] sm:text-[13px]">
          <span>#{bridge.tag.name}</span>
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
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-[var(--radius-card)] bg-[var(--community-blue)] px-3 text-xs font-extrabold text-white transition-colors hover:bg-[var(--community-blue-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none sm:min-h-11 sm:gap-1.5 sm:px-3.5 sm:text-[13px]"
      >
        {t(bridge.intent)}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
