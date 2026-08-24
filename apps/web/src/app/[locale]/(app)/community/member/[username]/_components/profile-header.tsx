"use client";

/* eslint-disable @next/next/no-img-element -- Public/R2 avatar URLs are not constrained to Next Image remote patterns. */

import {
  Globe,
  MoreHorizontal,
  Share2,
  Users,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { PublicProfile } from "@mentor/types";

import { AchievementShowcase } from "@/components/achievements/achievement-showcase";
import { JourneyLevelProfile } from "@/components/journey-levels/journey-level-profile";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { PremiumIdentityMark } from "@/components/premium/premium-identity-mark";
import { UserAvatar } from "@/components/user-avatar";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { resolveAvatarUrl } from "@/lib/avatar";
import { useMentorToast } from "@/lib/mentor-toast";
import { AuthorAvatar } from "../../../_components/author-avatar";
import { BadgeStrip } from "../../../_components/badge-strip";

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
      className="grid size-11 cursor-pointer place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-main)] transition-[background-color,border-color,transform] duration-200 ease-out hover:border-[color-mix(in_srgb,var(--color-main)_15%,transparent)] hover:bg-[var(--color-soft)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none xl:size-10"
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
  const reduceMotion = useReducedMotion();
  const [imageFailed, setImageFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const avatarUrl = imageFailed ? null : resolveAvatarUrl(profile.avatarUrl);
  const memberSince = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(profile.createdAt),
  );

  const openPreview = (trigger: HTMLButtonElement) => {
    previewTriggerRef.current = trigger;
    setPreviewOpen(true);
  };
  const closePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  useEffect(() => {
    if (!previewOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePreview, previewOpen]);

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
    <section className="profile-header overflow-hidden border-x border-[var(--color-border)] bg-[var(--color-surface)] xl:border-x-0">
      <div className="profile-hero relative min-h-[min(53dvh,448px)] overflow-hidden bg-[var(--color-surface)] sm:min-h-[428px] xl:min-h-[360px]">
        {avatarUrl ? (
          <button
            type="button"
            aria-label={t("profile_photo_open")}
            onClick={(event) => openPreview(event.currentTarget)}
            className="profile-hero__media cursor-zoom-in border-0 p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
          >
            {/* Public/R2 avatar URLs are not constrained to Next Image remote patterns. */}
            <img
              src={avatarUrl}
              alt=""
              aria-hidden="true"
              onError={() => setImageFailed(true)}
              className="profile-hero__image profile-hero__image--ambient"
            />
            <img
              src={avatarUrl}
              alt={t("profile_photo_alt", { name: profile.displayName })}
              onError={() => setImageFailed(true)}
              className="profile-hero__image profile-hero__image--primary"
            />
          </button>
        ) : (
          <div className="profile-hero__media profile-hero__fallback">
            <span>
              <AuthorAvatar name={profile.displayName} size={112} />
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-end p-4 sm:p-5">
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
                  className="grid size-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-surface)_90%,transparent)] text-[var(--color-main)] shadow-[var(--shadow-card)] transition-colors duration-200 hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
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

        <div className="profile-hero__identity absolute inset-x-0 bottom-0 z-20 rounded-t-[var(--radius-card)] bg-[var(--color-surface)] px-5 pb-5 pt-4 text-center sm:px-8 sm:pb-6 sm:pt-5 xl:rounded-none xl:px-7 xl:pb-5 xl:pt-14 xl:text-left">
          <button
            type="button"
            aria-label={avatarUrl ? t("profile_photo_open") : undefined}
            disabled={!avatarUrl}
            onClick={(event) => openPreview(event.currentTarget)}
            className="profile-desktop-avatar absolute -top-12 left-7 hidden size-24 rounded-full bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-default xl:block"
          >
            <UserAvatar
              name={profile.displayName}
              size={96}
              src={avatarUrl}
              alt={avatarUrl ? t("profile_photo_alt", { name: profile.displayName }) : ""}
              frame="strong"
            />
          </button>
          <div className="flex min-w-0 items-center justify-center gap-1.5 xl:justify-start">
            <h1 className="truncate text-[22px] font-bold leading-tight tracking-[-0.025em] text-[var(--color-main)] sm:text-2xl">
              {profile.displayName}
            </h1>
            {profile.isPremium ? <PremiumIdentityMark /> : null}
          </div>
          <p className="mt-1 text-[13px] font-medium text-[var(--color-secondary)]">@{profile.username}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[var(--color-secondary)] xl:justify-start">
            {profile.examType ? <span>{profile.examType}</span> : null}
            {profile.examType ? <span aria-hidden>·</span> : null}
            <span>{t("profile_member_since", { date: memberSince })}</span>
          </div>
          <div className="profile-metrics mx-auto mt-4 grid max-w-sm grid-cols-3 gap-3 xl:mx-0 xl:flex xl:w-auto xl:gap-8">
            <ProfileMetric value={profile.followerCount} label={t("followers_label")} locale={locale} onClick={onOpenFollowers} />
            <ProfileMetric value={profile.followingCount} label={t("following_label")} locale={locale} onClick={onOpenFollowing} />
            <ProfileMetric value={profile.activityCount} label={t("profile_activity_label")} locale={locale} />
          </div>
        </div>
      </div>

      <div className={`profile-header__details px-4 pb-5 sm:px-5 ${profile.bio || profile.website ? "xl:pb-5" : "xl:pb-0"}`}>
        <div className="profile-header__action-row flex items-center justify-center gap-3 xl:gap-2 xl:justify-end">
          <IconButton label={t("profile_share")} onClick={() => void shareProfile()}>
            <Share2 size={18} aria-hidden />
          </IconButton>
          {isOwn ? (
            <Link
              href={{ pathname: "/settings", query: { section: "profile" } }}
              className="inline-flex min-h-11 min-w-40 items-center justify-center rounded-full bg-[var(--color-btn)] px-6 text-sm font-bold text-[var(--color-btn-label)] transition-[opacity,transform] duration-200 ease-out hover:opacity-88 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none xl:min-h-10 xl:min-w-36 xl:px-5"
            >
              {t("edit_profile")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onToggleFollow}
              className={`min-h-11 min-w-40 rounded-full px-6 text-sm font-bold transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none xl:min-h-10 xl:min-w-36 xl:px-5 ${profile.isFollowing ? "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-main)] hover:bg-[color-mix(in_srgb,var(--color-main)_3%,transparent)]" : "bg-[var(--color-btn)] text-[var(--color-btn-label)] hover:opacity-88"}`}
            >
              {profile.isFollowing ? t("following_state") : t("follow")}
            </button>
          )}
          {!isOwn ? <BuddyAction status={profile.buddyStatus} onRequest={onBuddyRequest} /> : null}
        </div>

        {(profile.bio || profile.website) ? (
          <div className="mx-auto mt-5 max-w-[65ch] text-center xl:mx-0 xl:pl-3 xl:text-left">
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

      <AchievementShowcase
        showcase={profile.achievementShowcase}
        username={profile.username}
        enabled={profile.achievementsEnabled}
      />

      {avatarUrl
        ? createPortal(
            <AnimatePresence
              onExitComplete={() => previewTriggerRef.current?.focus()}
              initial={!reduceMotion}
            >
              {previewOpen ? (
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("profile_photo_preview_label", { name: profile.displayName })}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-8"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.25, 1, 0.5, 1] }}
                  onClick={closePreview}
                >
                  <button
                    type="button"
                    aria-label={t("attach_close")}
                    autoFocus
                    onClick={closePreview}
                    className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none sm:right-6 sm:top-6"
                  >
                    <X size={22} aria-hidden />
                  </button>
                  <motion.img
                    src={avatarUrl}
                    alt={t("profile_photo_alt", { name: profile.displayName })}
                    className="max-h-full max-w-full object-contain"
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.25, 1, 0.5, 1] }}
                    onClick={(event) => event.stopPropagation()}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
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
    <button type="button" onClick={onClick} className="min-h-11 rounded-[var(--radius-card)] px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] xl:text-left">
      {content}
    </button>
  ) : (
    <div className="min-h-11 px-1 xl:text-left">{content}</div>
  );
}

function BuddyAction({ status, onRequest }: { status: PublicProfile["buddyStatus"]; onRequest: () => void }) {
  const t = useTranslations("community");
  if (status === "unavailable") return null;
  if (status === "pending_incoming") {
    return (
      <Link href="/study-session" aria-label={t("buddy_respond")} className="grid size-11 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
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

export function ProfileProgressPanel({
  profile,
  isOwner,
}: {
  profile: PublicProfile;
  isOwner: boolean;
}) {
  const t = useTranslations("community");
  const level = profile.level;

  return (
    <section className="profile-progress-panel overflow-hidden rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--color-btn-label)_10%,transparent)] p-4 text-[var(--color-btn-label)] xl:p-5">
      {level ? (
        <JourneyLevelProfile level={level} isOwner={isOwner} />
      ) : (
        <>
          <h2 className="text-base font-bold">{t("profile_progress_title")}</h2>
          <p className="mt-5 text-sm text-[color-mix(in_srgb,var(--color-btn-label)_70%,transparent)]">{t("profile_progress_unavailable")}</p>
        </>
      )}

      <div className="mt-4 border-t border-[color-mix(in_srgb,var(--color-btn-label)_10%,transparent)] pt-3 xl:mt-5 xl:pt-4">
        <div className="flex items-center justify-between text-xs text-[color-mix(in_srgb,var(--color-btn-label)_65%,transparent)]">
          <span>{t("stat_streak")}</span>
          <span className="font-bold tabular-nums text-[var(--color-btn-label)]">{t("stat_streak_days", { count: profile.streak })}</span>
        </div>
      </div>

      {profile.badges.length > 0 ? (
        <div className="profile-badge-panel mt-4 border-t border-[color-mix(in_srgb,var(--color-btn-label)_10%,transparent)] pt-3 xl:mt-5 xl:pt-4">
          <BadgeStrip badges={profile.badges} detailed compact onDark />
        </div>
      ) : null}
    </section>
  );
}
