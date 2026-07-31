"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import House from "lucide-react/dist/esm/icons/house.mjs";
import Rss from "lucide-react/dist/esm/icons/rss.mjs";
import Bookmark from "lucide-react/dist/esm/icons/bookmark.mjs";
import Trophy from "lucide-react/dist/esm/icons/trophy.mjs";
import Hash from "lucide-react/dist/esm/icons/hash.mjs";
import Megaphone from "lucide-react/dist/esm/icons/megaphone.mjs";
import CircleHelp from "lucide-react/dist/esm/icons/circle-help.mjs";
import type { ZoneView } from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { Link, usePathname } from "@/i18n/navigation";
import { listZones } from "@/lib/forum";

/** Room groups in display order — one section header replaces the per-item category eyebrow. */
const GROUPS = [
  { type: "CHAT", key: "group_chat" },
  { type: "ANNOUNCEMENT", key: "group_announcement" },
  { type: "QA", key: "group_qa" },
] as const;

/**
 * Left column — chat rooms, grouped by type (Sohbet Odaları / Duyurular / Soru-Cevap). Each group
 * carries one eyebrow header; rooms below are a title + member-count stack (Trending Topics rhythm).
 */
export function ZoneSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("community");
  const pathname = usePathname();
  const [zones, setZones] = useState<ZoneView[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listZones()
      .then((res) => setZones(res.items))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="px-5">
        <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {t("error")}
        </p>
        <Link
          href="/community"
          onClick={onNavigate}
          className="mt-2 block text-xs underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-accent)" }}
        >
          {t("refresh")}
        </Link>
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-7 px-4">
      <div className="grid gap-1">
        {[
          {
            href: "/community" as const,
            label: t("hub_nav"),
            icon: House,
            active:
              pathname.endsWith("/community") ||
              pathname.endsWith("/topluluk"),
          },
          {
            href: "/community/feed" as const,
            label: t("feed_nav"),
            icon: Rss,
            active:
              pathname.endsWith("/community/feed") ||
              pathname.endsWith("/topluluk/akis"),
          },
          {
            href: "/community/saved" as const,
            label: t("saved_nav"),
            icon: Bookmark,
            active:
              pathname.endsWith("/community/saved") ||
              pathname.endsWith("/topluluk/kayitli"),
          },
          {
            href: "/community/leaderboard" as const,
            label: t("rank_page_title"),
            icon: Trophy,
            active:
              pathname.endsWith("/community/leaderboard") ||
              pathname.endsWith("/topluluk/siralama"),
          },
        ].map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-[9px] px-3 py-2 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${active ? "bg-[var(--community-blue-soft)] font-bold text-[var(--community-blue-ink)]" : "font-medium text-[#4d535f] hover:bg-white"}`}
          >
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>

      {zones === null ? (
        <div className="flex flex-col gap-4">
          <SkeletonGroup label={t("loading")}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[52px] w-full rounded-lg" />
            ))}
          </SkeletonGroup>
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {GROUPS.map(({ type, key }) => {
            const group = zones.filter((z) => z.type === type);
            const GroupIcon = type === "CHAT" ? Hash : type === "ANNOUNCEMENT" ? Megaphone : CircleHelp;
            const iconTone =
              type === "CHAT"
                ? "bg-[var(--community-blue-soft)] text-[var(--community-blue-ink)]"
                : type === "QA"
                  ? "bg-[#fff0ed] text-[#c94f3d]"
                  : "bg-[#eaf7f0] text-[#2f8f63]";
            if (group.length === 0) return null;
            return (
              <div key={type} className="flex flex-col gap-1">
                <p className="mb-2 px-2 text-[12px] font-bold text-[#6c727e]">
                  {t(key)}
                </p>
                {group.map((z) => {
                  const isActive =
                    pathname.includes(`/community/${z.slug}/`) || pathname.endsWith(`/community/${z.slug}`);
                  return (
                    <Link
                      key={z.id}
                      href={{
                        pathname: "/community/[slug]",
                        params: { slug: z.slug },
                      }}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-[9px] px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${isActive ? "bg-white ring-1 ring-inset ring-[var(--community-blue-border)]" : "hover:bg-white"}`}
                    >
                      <span className={`grid size-7 shrink-0 place-items-center rounded-[8px] ${iconTone}`}>
                        <GroupIcon size={14} strokeWidth={2} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`flex items-center gap-1.5 truncate text-[13px] ${isActive ? "font-bold text-[var(--community-blue-ink)]" : "font-medium text-[#252a35]"}`}>
                          <span className="min-w-0 truncate">{z.title}</span>
                        {z.myStatus === "ACTIVE" && (
                          <span
                              className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#65a777]"
                            aria-hidden="true"
                          />
                        )}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-[#858a94]">
                          {t("messages_count", { count: z.threadCount })}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );
}
