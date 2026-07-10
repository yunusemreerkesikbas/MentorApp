"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Rss from "lucide-react/dist/esm/icons/rss.mjs";
import type { ZoneView } from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
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
  const t = useTranslations("topluluk");
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
      <div className="px-6">
        <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {t("error")}
        </p>
        <Link
          href="/topluluk"
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
    <nav className="flex flex-col gap-6 px-6">
      {/* Heading — mirrors Figma "Trending Topics" title (Inter Bold 20px) */}
      <Link
        href="/topluluk"
        onClick={onNavigate}
        className="text-[20px] font-bold leading-[19px] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {t("sidebar_title")}
      </Link>

      {/* Cross-zone "Akış" — threads by the people you follow (above the room groups). */}
      <Link
        href="/topluluk/akis"
        onClick={onNavigate}
        aria-current={pathname.endsWith("/topluluk/akis") ? "page" : undefined}
        className="-mx-3 -mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{
          color: "var(--color-main)",
          background: pathname.endsWith("/topluluk/akis")
            ? "color-mix(in srgb, var(--color-chip) 16%, white)"
            : undefined,
        }}
      >
        <Rss size={16} aria-hidden="true" />
        {t("feed_nav")}
      </Link>

      {zones === null ? (
        <SkeletonGroup label={t("loading")} className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[52px] w-full rounded-lg" />
          ))}
        </SkeletonGroup>
      ) : (
        <div className="flex flex-col gap-6">
          {GROUPS.map(({ type, key }) => {
            const group = zones.filter((z) => z.type === type);
            if (group.length === 0) return null;
            return (
              <div key={type} className="flex flex-col gap-1">
                {/* Group header — one eyebrow per category, not per room */}
                <p
                  className="mb-1 text-[11px] font-semibold uppercase"
                  style={{ color: "var(--color-secondary)", letterSpacing: "0.08em" }}
                >
                  {t(key)}
                </p>
                {group.map((z) => {
                  const isActive =
                    pathname.includes(`/topluluk/${z.slug}/`) || pathname.endsWith(`/topluluk/${z.slug}`);
                  return (
                    <Link
                      key={z.id}
                      href={`/topluluk/${z.slug}`}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className="-mx-3 flex flex-col gap-[1px] rounded-lg px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                      style={{
                        background: isActive ? "color-mix(in srgb, var(--color-chip) 16%, white)" : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.background = "";
                      }}
                    >
                      {/* Room title */}
                      <span
                        className="flex items-center gap-1.5 truncate text-[14px]"
                        style={{ color: "var(--color-main)", fontWeight: isActive ? 700 : 400 }}
                      >
                        <span className="min-w-0 truncate">{z.title}</span>
                        {z.myStatus === "ACTIVE" && (
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                            style={{ background: "var(--color-progress)" }}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      {/* Member count */}
                      <span className="truncate text-[12px]" style={{ color: "#616161" }}>
                        {t("members", { count: z.memberCount })}
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
