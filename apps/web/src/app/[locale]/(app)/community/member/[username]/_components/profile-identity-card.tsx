"use client";

import { useRef, useState } from "react";
import { ChevronRight, Globe, Share2, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { PublicProfile } from "@mentor/types";
import { Button } from "@mentor/ui";
import { AchievementShowcase } from "@/components/achievements/achievement-showcase";
import { PANEL_CARD, LEDGE_OUTLINE, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { PremiumIdentityMark } from "@/components/premium/premium-identity-mark";
import { UserAvatar } from "@/components/user-avatar";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { resolveAvatarUrl } from "@/lib/avatar";
import { useMentorToast } from "@/lib/mentor-toast";
import { ProfilePhotoPreview } from "./profile-photo-preview";

/** The panel's small outline ledge, as a link (the owner's "Profili düzenle"). */
const OUTLINE_LINK = `${LEDGE_OUTLINE} inline-flex min-h-11 items-center justify-center rounded-[var(--play-radius)] px-5 text-body-sm font-extrabold transition-transform duration-[120ms] active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none`;

/**
 * A member's identity on the panel's card, no cover: avatar (opens the photo), name, @handle and
 * exam, bio, site, "N takipçi · N takip · N günlük seri", then the one ledge ("Takip et"; the
 * owner gets "Profili düzenle" in outline) with the buddy action as a text link beside it.
 */
export function ProfileIdentityCard({
  profile,
  isOwn,
  onToggleFollow,
  onBuddyRequest,
  onOpenFollowers,
  onOpenFollowing,
}: {
  profile: PublicProfile;
  isOwn: boolean;
  onToggleFollow: () => void;
  onBuddyRequest: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
}) {
  const t = useTranslations("community");
  const locale = useLocale();
  const toast = useMentorToast();
  const [imageFailed, setImageFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const avatarUrl = imageFailed ? null : resolveAvatarUrl(profile.avatarUrl);
  const memberSince = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(profile.createdAt),
  );
  const meta = [`@${profile.username}`, profile.examType, t("profile_member_since", { date: memberSince })]
    .filter(Boolean)
    .join(" · ");

  const shareProfile = async () => {
    const path = getPathname({
      locale: locale as Locale,
      href: { pathname: "/community/member/[username]", params: { username: profile.username } },
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

  const avatar = (
    <UserAvatar
      name={profile.displayName}
      size={72}
      src={avatarUrl}
      alt={avatarUrl ? t("profile_photo_alt", { name: profile.displayName }) : ""}
      onError={() => setImageFailed(true)}
    />
  );

  return (
    <section className={`profile-card ${PANEL_CARD} flex flex-col gap-4 sm:p-6`} aria-labelledby="profile-name">
      <div className="flex items-start gap-4">
        {avatarUrl ? (
          <button
            ref={avatarButtonRef}
            type="button"
            aria-label={t("profile_photo_open")}
            onClick={() => setPreviewOpen(true)}
            className="profile-avatar shrink-0 cursor-zoom-in rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
          >
            {avatar}
          </button>
        ) : (
          <span className="profile-avatar shrink-0">{avatar}</span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
          <div className="flex min-w-0 items-start gap-2">
            <h1 id="profile-name" className="min-w-0 break-words text-xl font-extrabold leading-tight text-[var(--color-main)] sm:text-title">
              {profile.displayName}
            </h1>
            {profile.isPremium ? <PremiumIdentityMark /> : null}
          </div>
          <p className="text-caption font-semibold text-[var(--color-secondary)]">{meta}</p>
        </div>
        <button
          type="button"
          aria-label={t("profile_share")}
          onClick={() => void shareProfile()}
          className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-card)] text-[var(--color-secondary)] hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Share2 size={19} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      {profile.bio ? (
        <p className="whitespace-pre-line break-words text-body-sm font-semibold text-[var(--color-body)]">{profile.bio}</p>
      ) : null}
      {profile.website ? (
        <a
          href={profile.website}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="-my-2 inline-flex min-h-11 items-center gap-1.5 self-start text-body-sm font-extrabold text-[var(--play-selected-ink)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Globe size={16} aria-hidden />
          {profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      ) : null}

      {/* Spacing, not dots, between the counts: on a phone the streak wraps without a dangling "·". */}
      <div className="profile-metrics flex flex-wrap items-center gap-x-5 text-body-sm font-bold text-[var(--color-secondary)]">
        <MetricButton value={profile.followerCount} label={t("followers_label")} onClick={onOpenFollowers} />
        <MetricButton value={profile.followingCount} label={t("following_label")} onClick={onOpenFollowing} />
        {profile.streak > 0 ? (
          <span className="inline-flex min-h-11 items-center font-extrabold text-[var(--color-main)]">
            {t("profile_streak", { count: profile.streak })}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {isOwn ? (
          <Link href={{ pathname: "/settings", query: { section: "profile" } }} className={OUTLINE_LINK}>
            {t("edit_profile")}
          </Link>
        ) : profile.isFollowing ? (
          <Button variant="secondary" size="sm" onClick={onToggleFollow}>
            {t("following_state")}
          </Button>
        ) : (
          <Button size="sm" onClick={onToggleFollow}>
            {t("follow")}
          </Button>
        )}
        {!isOwn ? <BuddyAction status={profile.buddyStatus} onRequest={onBuddyRequest} /> : null}
      </div>

      <AchievementShowcase
        showcase={profile.achievementShowcase}
        username={profile.username}
        enabled={profile.achievementsEnabled}
      />

      {avatarUrl ? (
        <ProfilePhotoPreview
          open={previewOpen}
          src={avatarUrl}
          name={profile.displayName}
          onClose={() => setPreviewOpen(false)}
          onClosed={() => avatarButtonRef.current?.focus()}
        />
      ) : null}
    </section>
  );
}

function MetricButton({ value, label, onClick }: { value: number; label: string; onClick: () => void }) {
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      <span className="font-extrabold tabular-nums text-[var(--color-main)]">{value.toLocaleString(locale)}</span>
      {/* A real space, so the button reads "1.130 takipçi", not "1.130takipçi". */}
      {" "}
      {label}
    </button>
  );
}

/** The buddy relation as words: an invitation link, or where things stand. */
function BuddyAction({ status, onRequest }: { status: PublicProfile["buddyStatus"]; onRequest: () => void }) {
  const t = useTranslations("community");
  if (status === "unavailable") return null;
  if (status === "pending_incoming") {
    return (
      <Link href="/study-session" className={PANEL_TEXT_LINK}>
        {t("buddy_respond")}
        <ChevronRight size={16} aria-hidden />
      </Link>
    );
  }
  if (status === "active" || status === "pending_outgoing") {
    return (
      <span role="status" className="inline-flex min-h-11 items-center gap-1.5 text-body-sm font-extrabold text-[var(--color-secondary)]">
        <Users size={16} aria-hidden />
        {status === "active" ? t("buddy_active") : t("buddy_pending")}
      </span>
    );
  }
  return (
    <button type="button" onClick={onRequest} className={`${PANEL_TEXT_LINK} cursor-pointer`}>
      {t("buddy_request")}
      <ChevronRight size={16} aria-hidden />
    </button>
  );
}
