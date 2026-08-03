"use client";
import { Flame, Globe, Zap } from "lucide-react";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { PublicProfile } from "@mentor/types";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { AuthorAvatar } from "../../../_components/author-avatar";
import { BadgeStrip } from "../../../_components/badge-strip";

/** One compact metric on the stat rail — small tinted icon + inline value/label. Not a card. */
function StatInline({
  icon,
  tint,
  value,
  label,
}: {
  icon: ReactNode;
  tint: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: tint, color: "var(--color-main)" }}
      >
        {icon}
      </span>
      <div className="leading-tight">
        <p className="text-[15px] font-bold tabular-nums" style={{ color: "var(--color-main)" }}>
          {value}
        </p>
        <p className="text-[11px]" style={{ color: "var(--color-secondary)" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

/**
 * Public profile header — a compact identity band (avatar + name + @handle + examType + join date) over
 * a slim gamification rail (streak · XP · level). Deliberately NOT the big stat-tile cards the right-column
 * effort board uses: on your own profile those would duplicate the right card and read as a hero-metric
 * block. Effort-only (§3 anti-shaming); economy-gated cells degrade when xp/level are null.
 */
interface ProfileHeaderProps {
  profile: PublicProfile;
  /** The viewer's own profile → no follow button (can't follow yourself). */
  isOwn: boolean;
  onToggleFollow: () => void;
  onBuddyRequest: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
}

/** Secondary buddy action next to follow — driven by the viewer's buddyStatus. */
function BuddyAction({
  status,
  onRequest,
}: {
  status: PublicProfile["buddyStatus"];
  onRequest: () => void;
}) {
  const t = useTranslations("community");
  // "unavailable" = viewer already paired with someone else → no action to offer.
  if (status === "unavailable") return null;
  if (status === "pending_incoming") {
    return (
      <Link
        href="/study-session"
        className="inline-flex items-center rounded-[var(--radius-card)] border border-black/10 bg-white px-3 py-2 text-[13px] font-semibold transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-main)" }}
      >
        {t("buddy_respond")}
      </Link>
    );
  }
  if (status === "active" || status === "pending_outgoing") {
    return (
      <span
        className="inline-flex items-center rounded-[var(--radius-card)] px-3 py-2 text-[13px] font-semibold"
        style={{
          background: "color-mix(in srgb, var(--color-progress) 12%, transparent)",
          color: "var(--color-main)",
        }}
      >
        {status === "active" ? t("buddy_active") : t("buddy_pending")}
      </span>
    );
  }
  return (
    <Button variant="secondary" onClick={onRequest}>
      {t("buddy_request")}
    </Button>
  );
}

export function ProfileHeader({
  profile,
  isOwn,
  onToggleFollow,
  onBuddyRequest,
  onOpenFollowers,
  onOpenFollowing,
}: ProfileHeaderProps) {
  const t = useTranslations("community");
  const locale = useLocale();
  const memberSince = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(profile.createdAt),
  );
  const level = profile.level;
  const pct = level?.nextAt ? Math.min(100, Math.round((level.xp / level.nextAt) * 100)) : 100;

  return (
    <div className="border-b px-4 py-6 lg:px-6" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      {/* Identity band */}
      <div className="flex items-start gap-4">
        <AuthorAvatar name={profile.displayName} size={72} src={profile.avatarUrl} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h1
            className="truncate text-[22px] font-bold leading-tight"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {profile.displayName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium" style={{ color: "var(--color-secondary)" }}>
              @{profile.username}
            </span>
            {profile.examType ? (
              <span
                className="rounded-full px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: "#f4f4f5", color: "var(--color-secondary)" }}
              >
                {profile.examType}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--color-secondary)" }}>
            {t("profile_member_since", { date: memberSince })}
          </p>
          {/* Follower / following counts — clickable, open the respective list. */}
          <div className="mt-2 flex items-center gap-4 text-[13px]">
            <button
              type="button"
              onClick={onOpenFollowers}
              className="transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ color: "var(--color-secondary)" }}
            >
              <span className="font-bold tabular-nums" style={{ color: "var(--color-main)" }}>
                {profile.followerCount.toLocaleString(locale)}
              </span>{" "}
              {t("followers_label")}
            </button>
            <button
              type="button"
              onClick={onOpenFollowing}
              className="transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ color: "var(--color-secondary)" }}
            >
              <span className="font-bold tabular-nums" style={{ color: "var(--color-main)" }}>
                {profile.followingCount.toLocaleString(locale)}
              </span>{" "}
              {t("following_label")}
            </button>
          </div>
        </div>
        <div className="shrink-0 pt-0.5">
          {isOwn ? (
            <Link
              href="/profile"
              className="inline-flex items-center rounded-[var(--radius-card)] border border-black/10 bg-white px-3 py-2 text-[13px] font-semibold transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ color: "var(--color-main)" }}
            >
              {t("edit_profile")}
            </Link>
          ) : (
            <div className="flex flex-col items-end gap-2">
              <Button
                variant={profile.isFollowing ? "secondary" : "primary"}
                onClick={onToggleFollow}
              >
                {profile.isFollowing ? t("following_state") : t("follow")}
              </Button>
              <BuddyAction status={profile.buddyStatus} onRequest={onBuddyRequest} />
            </div>
          )}
        </div>
      </div>

      {/* Bio + website — public identity (no PII). */}
      {(profile.bio || profile.website) && (
        <div className="mt-4 flex flex-col gap-2">
          {profile.bio && (
            <p
              className="whitespace-pre-line break-words text-[14px] leading-relaxed"
              style={{ color: "var(--color-main)" }}
            >
              {profile.bio}
            </p>
          )}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ color: "var(--color-accent)" }}
            >
              <Globe size={14} aria-hidden="true" />
              {profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
        </div>
      )}

      {/* Gamification rail — inline, quiet, no cards */}
      <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-4">
        <StatInline
          icon={<Flame size={16} aria-hidden="true" />}
          tint="color-mix(in srgb, var(--color-star) 16%, white)"
          value={t("stat_streak_days", { count: profile.streak })}
          label={t("stat_streak")}
        />
        {profile.xp !== null && (
          <StatInline
            icon={<Zap size={16} aria-hidden="true" />}
            tint="color-mix(in srgb, var(--color-progress) 16%, white)"
            value={profile.xp.toLocaleString(locale)}
            label={t("stat_xp")}
          />
        )}
        {level && (
          <div className="min-w-[140px] flex-1 sm:max-w-[240px]">
            <div
              className="flex items-center justify-between text-[12px]"
              style={{ color: "var(--color-secondary)" }}
            >
              <span className="font-medium" style={{ color: "var(--color-main)" }}>
                {t("level_label", { tier: level.tier })} · {t(`level_${level.tier}` as "level_1")}
              </span>
              {level.nextAt && (
                <span className="tabular-nums">
                  {level.xp}/{level.nextAt}
                </span>
              )}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "#ececec" }}>
              <div
                className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${pct}%`, background: "var(--color-progress)" }}
              />
            </div>
          </div>
        )}
      </div>

      {profile.badges.length > 0 && (
        <div className="mt-5">
          <BadgeStrip badges={profile.badges} />
        </div>
      )}
    </div>
  );
}
