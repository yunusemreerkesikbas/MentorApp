"use client";
import { Bookmark, Compass, Rss, Trophy } from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { ZoneView } from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { getCommunitySummary } from "@/lib/community";
import { listZones } from "@/lib/forum";
import { AuthorAvatar } from "./author-avatar";
import { ZoneTypeIcon } from "./zone-type-icon";

/** Fired after a join or leave elsewhere on the page, so "Odaların" regroups without a reload. */
export const ZONES_CHANGED_EVENT = "community:zones-changed";

const ROW =
  "relative isolate flex min-h-11 items-center gap-3 overflow-hidden rounded-[var(--radius-card)] px-2.5 text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/**
 * Left column: sections, then rooms in two groups (yours / the rest), then the viewer's profile.
 * A room is told by its glyph, never by a colour; the selected row is the panel's selection tone.
 */
export function ZoneSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("community");
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const { user } = useAuth();
  const params = useParams<{ slug?: string; username?: string }>();
  const activeZoneSlug = params.slug;
  const [rankingEnabled, setRankingEnabled] = useState(false);
  const [zones, setZones] = useState<ZoneView[] | null>(null);

  const loadZones = useCallback(() => {
    listZones()
      .then((res) => setZones(res.items))
      .catch(() => setZones([]));
  }, []);

  useEffect(() => {
    getCommunitySummary().then((res) => setRankingEnabled(res.leaderboard != null)).catch(() => setRankingEnabled(false));
    loadZones();
    window.addEventListener(ZONES_CHANGED_EVENT, loadZones);
    return () => window.removeEventListener(ZONES_CHANGED_EVENT, loadZones);
  }, [loadZones]);

  const activeTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 430, damping: 32, mass: 0.75 };

  const highlight = (
    <motion.span
      layoutId="community-sidebar-active-link"
      className="absolute inset-0 -z-10 rounded-[var(--radius-card)] bg-[var(--play-selected)]"
      transition={activeTransition}
      aria-hidden
    />
  );

  // next-intl's pathname is the route template here, so whose profile it is comes from the params.
  const onProfile =
    !!user?.username &&
    pathname === "/community/member/[username]" &&
    params.username === user.username;

  // next-intl's pathname is the route template (`/community/feed`), never the localized `/topluluk/akis`.
  const sections = [
    {
      href: "/community" as const,
      label: t("hub_nav"),
      icon: Compass,
      active: pathname === "/community",
    },
    {
      href: "/community/feed" as const,
      label: t("feed_nav"),
      icon: Rss,
      active: pathname === "/community/feed",
    },
    {
      href: "/community/saved" as const,
      label: t("saved_nav"),
      icon: Bookmark,
      active: pathname === "/community/saved",
    },
    ...(rankingEnabled
      ? [{
          href: "/community/leaderboard" as const,
          label: t("rank_page_title"),
          icon: Trophy,
          active: pathname === "/community/leaderboard",
        }]
      : []),
  ];

  const groups = zones
    ? [
        { key: "group_mine", items: zones.filter((z) => z.myStatus === "ACTIVE") },
        { key: "group_others", items: zones.filter((z) => z.myStatus !== "ACTIVE") },
      ].filter((group) => group.items.length > 0)
    : [];

  const rooms =
    zones === null ? (
      <div className="min-h-[16rem]" aria-hidden />
    ) : (
      <div className="flex flex-col gap-5">
        {groups.map(({ key, items }) => (
          <div key={key} className="flex flex-col gap-0.5">
            <p className="mb-1 px-2.5 text-xs font-extrabold text-[var(--color-secondary)]">
              {t(key as "group_mine" | "group_others")}
            </p>
            {items.map((z) => {
              const isActive = activeZoneSlug === z.slug;
              const mine = z.myStatus === "ACTIVE";
              return (
                <Link
                  key={z.id}
                  href={{ pathname: "/community/[slug]", params: { slug: z.slug } }}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={`${ROW} ${isActive ? "font-extrabold text-[var(--play-selected-ink)]" : mine ? "font-bold text-[var(--color-main)] hover:bg-[var(--color-surface-container)]" : "font-semibold text-[var(--color-secondary)] hover:bg-[var(--color-surface-container)]"}`}
                >
                  {isActive ? highlight : null}
                  <ZoneTypeIcon
                    type={z.type}
                    size={18}
                    strokeWidth={isActive ? 2.2 : 1.75}
                    className={`shrink-0 ${isActive ? "text-[var(--play-selected-ink)]" : "text-[var(--color-secondary)]"}`}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">{z.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    );

  return (
    <LayoutGroup id="community-sidebar-navigation">
      <nav className="flex min-h-full flex-col gap-5 px-3" aria-label={t("sidebar_title")}>
        <div className="grid gap-0.5">
          {sections.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={label}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`${ROW} ${active ? "font-extrabold text-[var(--play-selected-ink)]" : "font-bold text-[var(--color-body)] hover:bg-[var(--color-surface-container)]"}`}
            >
              {active ? highlight : null}
              <Icon
                size={19}
                strokeWidth={active ? 2.2 : 1.75}
                className={active ? "text-[var(--play-selected-ink)]" : "text-[var(--color-secondary)]"}
                aria-hidden="true"
              />
              <span>{label}</span>
            </Link>
          ))}
        </div>

        <SkeletonGroup label={t("loading")} loading={zones === null} revealed={rooms} className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-[var(--radius-card)]" />
          ))}
        </SkeletonGroup>

        {user?.username ? (
          <div className="mt-auto border-t border-[var(--color-border)] pt-3">
            <Link
              href={{ pathname: "/community/member/[username]", params: { username: user.username } }}
              onClick={onNavigate}
              aria-current={onProfile ? "page" : undefined}
              className={`${ROW} min-h-14 ${onProfile ? "text-[var(--play-selected-ink)]" : "text-[var(--color-main)] hover:bg-[var(--color-surface-container)]"}`}
            >
              {onProfile ? highlight : null}
              <AuthorAvatar name={user.displayName} src={user.avatarUrl} size={32} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-extrabold">{user.displayName}</span>
                <span className="text-xs font-semibold text-[var(--color-secondary)]">{t("profile_nav")}</span>
              </span>
            </Link>
          </div>
        ) : null}
      </nav>
    </LayoutGroup>
  );
}
