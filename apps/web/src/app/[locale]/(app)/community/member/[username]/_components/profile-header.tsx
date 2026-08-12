"use client";

import {
  ArrowLeft,
  Globe,
  MoreHorizontal,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { PublicProfile } from "@mentor/types";

import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { resolveAvatarUrl } from "@/lib/avatar";
import { useMentorToast } from "@/lib/mentor-toast";
import { AuthorAvatar } from "../../../_components/author-avatar";
import { BadgeStrip } from "../../../_components/badge-strip";
import { getProfileLevelWindow } from "./profile-level-window";

const MAX_LEVEL = 12;

interface ProfileHeaderProps {
  profile: PublicProfile;
  isOwn: boolean;
  onToggleFollow: () => void;
  onBuddyRequest: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 cursor-pointer place-items-center rounded-full bg-white/90 text-[var(--color-main)] shadow-[var(--shadow-card)] transition-colors duration-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
    >
      {children}
    </button>
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
  const toast = useMentorToast();
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = imageFailed ? null : resolveAvatarUrl(profile.avatarUrl);
  const memberSince = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(profile.createdAt),
  );

  const shareProfile = async () => {
    const path = getPathname({
      locale: locale as Locale,
      href: {
        pathname: "/community/member/[username]",
        params: { username: profile.username },
      },
    });
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: profile.displayName, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success({ title: t("profile_share_copied") });
    } catch {
      toast.error({ title: t("error") });
    }
  };

  return (
    <section className="profile-header overflow-hidden bg-white sm:border-x sm:border-[#e7e9ee]">
      <div className="profile-hero relative min-h-[min(52dvh,440px)] overflow-hidden bg-white sm:min-h-[420px]">
        {avatarUrl ? (
          <div className="profile-hero__media">
            {/* Public/R2 avatar URLs are not constrained to Next Image remote patterns. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt=""
              aria-hidden="true"
              onError={() => setImageFailed(true)}
              className="profile-hero__image profile-hero__image--ambient"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={t("profile_photo_alt", { name: profile.displayName })}
              onError={() => setImageFailed(true)}
              className="profile-hero__image profile-hero__image--primary"
            />
          </div>
        ) : (
          <div className="profile-hero__media profile-hero__fallback">
            <span>
              <AuthorAvatar name={profile.displayName} size={112} />
            </span>
          </div>
        )}

        <div className="profile-hero__mist" aria-hidden />

        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between p-4 sm:p-5">
          <Link
            href="/community"
            aria-label={t("back")}
            className="grid size-11 place-items-center rounded-full bg-white/90 text-[var(--color-main)] shadow-[var(--shadow-card)] transition-colors duration-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          >
            <ArrowLeft size={20} aria-hidden />
          </Link>

          {!isOwn ? (
            <PopoverMenu
              align="right"
              trigger={({ open, setOpen, menuId }) => (
                <button
                  type="button"
                  aria-label={t("actions")}
                  aria-expanded={open}
                  aria-controls={open ? menuId : undefined}
                  aria-haspopup="menu"
                  onClick={() => setOpen(!open)}
                  className="grid size-11 place-items-center rounded-full bg-white/90 text-[var(--color-main)] shadow-[var(--shadow-card)] transition-colors duration-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                >
                  <MoreHorizontal size={20} aria-hidden />
                </button>
              )}
            >
              <PopoverMenuItem onClick={() => void shareProfile()}>{t("profile_share")}</PopoverMenuItem>
              {profile.website ? (
                <PopoverMenuItem onClick={() => window.open(profile.website!, "_blank", "noopener,noreferrer")}>
                  {t("profile_open_website")}
                </PopoverMenuItem>
              ) : null}
            </PopoverMenu>
          ) : null}
        </div>

        <div className="profile-hero__identity absolute inset-x-0 bottom-0 z-20 px-5 pb-5 text-center sm:px-8 sm:pb-6">
          <div className="flex min-w-0 items-center justify-center gap-1.5">
            <h1 className="truncate text-[24px] font-bold leading-tight text-[var(--color-main)]">
              {profile.displayName}
            </h1>
            {profile.isPremium ? (
              <span
                role="img"
                aria-label={t("profile_premium_member")}
                title={t("profile_premium_member")}
                className="grid size-5 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-star)_28%,white)] text-[var(--color-main)] shadow-[0_1px_3px_rgb(19_23_34_/_12%)]"
              >
                <Sparkles size={12} strokeWidth={2.4} aria-hidden />
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--color-secondary)]">@{profile.username}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[var(--color-secondary)]">
            {profile.examType ? <span>{profile.examType}</span> : null}
            {profile.examType ? <span aria-hidden>·</span> : null}
            <span>{t("profile_member_since", { date: memberSince })}</span>
          </div>
          <div className="mx-auto mt-4 grid max-w-sm grid-cols-3 gap-3">
            <ProfileMetric value={profile.followerCount} label={t("followers_label")} locale={locale} onClick={onOpenFollowers} />
            <ProfileMetric value={profile.followingCount} label={t("following_label")} locale={locale} onClick={onOpenFollowing} />
            <ProfileMetric value={profile.activityCount} label={t("profile_activity_label")} locale={locale} />
          </div>
        </div>
      </div>

      <div className="px-4 pb-5 sm:px-5">
        <div className="flex items-center justify-center gap-3">
          <IconButton label={t("profile_share")} onClick={() => void shareProfile()}>
            <Share2 size={18} aria-hidden />
          </IconButton>
          {isOwn ? (
            <Link
              href={{ pathname: "/settings", query: { section: "profile" } }}
              className="inline-flex min-h-11 min-w-40 items-center justify-center rounded-full bg-[var(--color-btn)] px-6 text-sm font-bold text-white transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              {t("edit_profile")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onToggleFollow}
              className={`min-h-11 min-w-40 rounded-full px-6 text-sm font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none ${profile.isFollowing ? "border border-black/10 bg-white text-[var(--color-main)]" : "bg-[var(--color-btn)] text-white"}`}
            >
              {profile.isFollowing ? t("following_state") : t("follow")}
            </button>
          )}
          {!isOwn ? <BuddyAction status={profile.buddyStatus} onRequest={onBuddyRequest} /> : null}
        </div>

        {(profile.bio || profile.website) ? (
          <div className="mx-auto mt-5 max-w-[65ch] text-center">
            {profile.bio ? <p className="whitespace-pre-line break-words text-sm leading-6 text-[var(--color-body-text)]">{profile.bio}</p> : null}
            {profile.website ? (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <Globe size={15} aria-hidden />
                {profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProfileMetric({
  value,
  label,
  locale,
  onClick,
}: {
  value: number;
  label: string;
  locale: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="block text-base font-bold tabular-nums text-[var(--color-main)]">{value.toLocaleString(locale)}</span>
      <span className="mt-0.5 block text-[11px] text-[var(--color-secondary)]">{label}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="min-h-11 rounded-[var(--radius-card)] px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
      {content}
    </button>
  ) : (
    <div className="min-h-11 px-1">{content}</div>
  );
}

function BuddyAction({ status, onRequest }: { status: PublicProfile["buddyStatus"]; onRequest: () => void }) {
  const t = useTranslations("community");
  if (status === "unavailable") return null;
  if (status === "pending_incoming") {
    return (
      <Link href="/study-session" aria-label={t("buddy_respond")} className="grid size-11 place-items-center rounded-full border border-black/10 bg-white text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
        <Users size={18} aria-hidden />
      </Link>
    );
  }
  if (status === "active" || status === "pending_outgoing") {
    const label = status === "active" ? t("buddy_active") : t("buddy_pending");
    return (
      <span
        role="status"
        aria-label={label}
        className="grid size-11 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-main)]"
        title={label}
      >
        <Users size={18} aria-hidden />
      </span>
    );
  }
  return (
    <IconButton label={t("buddy_request")} onClick={onRequest}>
      <Users size={18} aria-hidden />
    </IconButton>
  );
}

export function ProfileProgressPanel({ profile }: { profile: PublicProfile }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const level = profile.level;
  const percent = level?.nextAt ? Math.min(100, Math.round((level.xp / level.nextAt) * 100)) : 100;
  const levels = level ? getProfileLevelWindow(level.tier, MAX_LEVEL) : [];

  return (
    <section className="profile-progress-panel overflow-hidden rounded-[var(--radius-card)] p-4 text-white shadow-[var(--shadow-card)] xl:p-5">
      <h2 className="text-base font-bold">{t("profile_progress_title")}</h2>

      {level ? (
        <>
          <div className="mt-3 grid grid-cols-3 items-end gap-2 xl:mt-4" aria-label={t("level_label", { tier: level.tier })}>
            {levels.map((tier, index) => (
              <LevelMedallion
                key={`${tier ?? "empty"}-${index}`}
                tier={tier}
                current={tier === level.tier}
                future={tier === null || tier > level.tier}
              />
            ))}
          </div>
          <div className="mt-2 text-center xl:mt-4">
            <p className="text-sm font-bold text-white">{t("level_label", { tier: level.tier })} · {t(`level_${level.tier}` as "level_1")}</p>
          </div>
          <div className="mt-3 xl:mt-4">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>{t("stat_xp")}</span>
              <span className="tabular-nums">{level.xp.toLocaleString(locale)}{level.nextAt ? ` / ${level.nextAt.toLocaleString(locale)}` : ""}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15 xl:mt-2">
              <div className="h-full rounded-full bg-[var(--color-progress)]" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </>
      ) : (
        <p className="mt-5 text-sm text-white/70">{t("profile_progress_unavailable")}</p>
      )}

      <div className="mt-4 border-t border-white/10 pt-3 xl:mt-5 xl:pt-4">
        <div className="flex items-center justify-between text-xs text-white/65">
          <span>{t("stat_streak")}</span>
          <span className="font-bold tabular-nums text-white">{t("stat_streak_days", { count: profile.streak })}</span>
        </div>
      </div>

      {profile.badges.length > 0 ? (
        <div className="profile-badge-panel mt-4 border-t border-white/10 pt-3 xl:mt-5 xl:pt-4">
          <BadgeStrip badges={profile.badges} detailed compact onDark />
        </div>
      ) : null}
    </section>
  );
}

function LevelMedallion({ tier, current, future }: { tier: number | null; current: boolean; future: boolean }) {
  return (
    <div className={`profile-level-medallion flex flex-col items-center transition-transform duration-200 motion-reduce:transition-none ${current ? "profile-level-medallion--current -translate-y-1" : ""}`}>
      <div className={`relative grid aspect-square w-full max-w-16 place-items-center xl:max-w-[76px] ${future ? "opacity-45" : ""}`}>
        <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d="M40 3 70 20v40L40 77 10 60V20Z" fill={current ? "var(--color-progress)" : future ? "transparent" : "color-mix(in srgb, var(--color-progress-track) 70%, white)"} stroke={future ? "rgba(255,255,255,.72)" : current ? "var(--color-progress-track)" : "#FFFFFF"} strokeWidth={current ? "3" : "2"} />
          <path d="M40 10 64 24v32L40 70 16 56V24Z" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1" />
        </svg>
        {tier === null ? null : (
          <span className={`relative text-lg font-extrabold tabular-nums ${current ? "text-white" : future ? "text-white" : "text-[var(--color-main)]"}`}>{tier}</span>
        )}
      </div>
    </div>
  );
}
