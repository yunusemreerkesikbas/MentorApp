"use client";
import { Bookmark, House, Rss, TrendingUp, Trophy } from "lucide-react";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { ZoneView } from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { listZones } from "@/lib/forum";
import { ZoneTypeIcon } from "./zone-type-icon";

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
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const params = useParams<{ slug?: string }>();
  const activeZoneSlug = params.slug;
  const [zones, setZones] = useState<ZoneView[] | null>(null);

  useEffect(() => {
    listZones()
      .then((res) => setZones(res.items))
      .catch(() => setZones([]));
  }, []);

  const activeTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 430, damping: 32, mass: 0.75 };

  return (
    <LayoutGroup id="community-sidebar-navigation">
    <nav className="flex flex-col gap-5 px-3">
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
          ...(user?.username ? [{
            href: {
              pathname: "/community/member/[username]" as const,
              params: { username: user.username },
              query: { tab: "bookmarks" },
            },
            label: t("saved_nav"),
            icon: Bookmark,
            active:
              (pathname.endsWith(`/community/member/${user.username}`) ||
                pathname.endsWith(`/topluluk/uye/${user.username}`)) &&
              ["bookmarks", "saved"].includes(searchParams.get("tab") ?? ""),
          }] : []),
          {
            href: "/community/leaderboard" as const,
            label: t("rank_page_title"),
            icon: Trophy,
            active:
              pathname.endsWith("/community/leaderboard") ||
              pathname.endsWith("/topluluk/siralama"),
          },
          {
            href: "/community/trends" as const,
            label: t("trends_nav"),
            icon: TrendingUp,
            active:
              pathname.endsWith("/community/trends") ||
              pathname.endsWith("/topluluk/gundem"),
          },
        ].map(({ href, label, icon: Icon, active }) => (
          <Link
            key={label}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`relative isolate flex min-h-11 items-center gap-3 overflow-hidden rounded-[10px] px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${active ? "font-bold text-[var(--community-blue-ink)]" : "font-medium text-[var(--color-secondary)] hover:bg-[var(--color-surface)]"}`}
          >
            {active ? (
              <motion.span
                layoutId="community-sidebar-active-link"
                className="absolute inset-0 -z-10 rounded-[10px] bg-[var(--community-blue-soft)]"
                transition={activeTransition}
                aria-hidden
              />
            ) : null}
            <motion.span
              className="inline-flex"
              animate={reduceMotion ? undefined : { scale: active ? 1.12 : 1, rotate: active ? -4 : 0 }}
              transition={activeTransition}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
            </motion.span>
            <span>{label}</span>
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
        <div className="flex flex-col gap-5">
          {GROUPS.map(({ type, key }) => {
            const group = zones.filter((z) => z.type === type);
            const iconTone =
              type === "CHAT"
                ? "text-[var(--community-blue-ink)]"
                : type === "QA"
                  ? "text-[var(--community-coral)]"
                  : "text-[var(--community-green)]";
            if (group.length === 0) return null;
            return (
              <div key={type} className="flex flex-col gap-1">
                <p className="mb-1 px-2 text-xs font-bold text-[var(--color-secondary)]">
                  {t(key)}
                </p>
                {group.map((z) => {
                  const isActive = activeZoneSlug === z.slug;
                  return (
                    <Link
                      key={z.id}
                      href={{
                        pathname: "/community/[slug]",
                        params: { slug: z.slug },
                      }}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={`relative isolate flex min-h-11 items-center gap-2.5 overflow-hidden rounded-[10px] px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${isActive ? "font-bold text-[var(--community-blue-ink)]" : "hover:bg-[var(--color-surface)]"}`}
                    >
                      {isActive ? (
                        <motion.span
                          layoutId="community-sidebar-active-link"
                          className="absolute inset-0 -z-10 rounded-[10px] bg-[var(--community-blue-soft)]"
                          transition={activeTransition}
                          aria-hidden
                        />
                      ) : null}
                      <motion.span
                        className={`grid size-6 shrink-0 place-items-center ${isActive ? "text-[var(--community-blue-ink)]" : iconTone}`}
                        animate={reduceMotion ? undefined : { scale: isActive ? 1.14 : 1, rotate: isActive ? -5 : 0 }}
                        transition={activeTransition}
                      >
                        <ZoneTypeIcon type={type} size={16} strokeWidth={isActive ? 2.2 : 2} aria-hidden />
                      </motion.span>
                      <span className="min-w-0 flex-1">
                        <span className={`flex items-center gap-1.5 truncate text-sm ${isActive ? "font-bold text-[var(--community-blue-ink)]" : "font-medium text-[var(--color-body-text)]"}`}>
                          <span className="min-w-0 truncate">{z.title}</span>
                        {z.myStatus === "ACTIVE" && (
                          <span
                              className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-success)]"
                            aria-hidden="true"
                          />
                        )}
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
    </LayoutGroup>
  );
}
