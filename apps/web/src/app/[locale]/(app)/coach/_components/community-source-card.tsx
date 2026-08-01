"use client";

import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right.mjs";
import { useTranslations } from "next-intl";
import type {
  CoachConversationOriginDto,
  ForumCoachBridgeView,
} from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { PuhuImage } from "@/components/puhu-image";
import { trackCoachEvent } from "@/lib/analytics";

type SafeCommunitySource = ForumCoachBridgeView & {
  zone: ForumCoachBridgeView["zone"] & { type: "CHAT" | "QA" };
};

function isSafeCommunitySource(
  source: ForumCoachBridgeView | null,
): source is SafeCommunitySource {
  return source?.zone.type === "CHAT" || source?.zone.type === "QA";
}

export function CommunitySourceCard({
  origin,
  source,
}: {
  origin: CoachConversationOriginDto | null;
  source: ForumCoachBridgeView | null;
}) {
  const t = useTranslations("coach_chat");
  if (origin?.type !== "COMMUNITY_THREAD") return null;
  const safeSource = isSafeCommunitySource(source) ? source : null;

  const href = safeSource
    ? safeSource.zone.type === "QA"
      ? { pathname: "/community/question/[threadId]" as const, params: { threadId: safeSource.threadId } }
      : { pathname: "/community/message/[threadId]" as const, params: { threadId: safeSource.threadId } }
    : null;

  return (
    <aside className="mb-2 flex min-h-16 items-center gap-3 rounded-[12px] border border-[#c9dcf7] bg-[#f3f8ff] px-3 py-2.5" aria-label={t("community_source")}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white">
        <PuhuImage variant="encouraging" size={30} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#4e75a8]">
          {t("community_source")}
        </p>
        {safeSource ? (
          <>
            <p className="truncate text-sm font-extrabold text-[#23354d]">
              #{safeSource.tag.name} <span className="font-semibold text-[#728096]">· {safeSource.zone.title}</span>
            </p>
            {safeSource.threadTitle ? (
              <p className="truncate text-xs text-[#728096]">{safeSource.threadTitle}</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm font-semibold text-[#728096]">{t("source_unavailable")}</p>
        )}
      </div>
      {href && safeSource ? (
        <Link
          href={href}
          onClick={() => trackCoachEvent("coach_community_return_click", {
            zone_type: safeSource.zone.type,
            intent: origin.meta.intent,
          })}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-[9px] px-3 text-sm font-extrabold text-[#2463a8] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
        >
          <span className="hidden sm:inline">{t("return_to_discussion")}</span>
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </aside>
  );
}
