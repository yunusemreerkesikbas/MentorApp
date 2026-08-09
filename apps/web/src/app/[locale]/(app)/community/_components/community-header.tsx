"use client";
import { MessageCircle } from "lucide-react";

import { useTranslations } from "next-intl";
import { NotificationBell } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { CircularBackLink } from "@/components/circular-back-link";
import { AuthorAvatar } from "./author-avatar";
import { CommunitySearch } from "./community-search";

export function CommunityHeader() {
  const t = useTranslations("community");
  const common = useTranslations("common");
  const { user } = useAuth();

  return (
    <header className="community-header">
      <div className="community-header__brand">
        <CircularBackLink href="/dashboard" label={t("back_short")} />
        <Link href="/community" className="community-header__wordmark">
          <span className="community-header__mark" aria-hidden>
            <MessageCircle size={17} strokeWidth={2.2} />
          </span>
          <span className="community-header__wordmark-label">{t("sidebar_title")}</span>
        </Link>
      </div>

      <CommunitySearch />

      <div className="community-header__actions">
        <NotificationBell
          label={common("notifications_label")}
          unreadLabel={common("notifications_unread_label")}
          desktopSide="right"
        />
        {user ? (
          <Link href="/profile" className="community-header__profile">
            <AuthorAvatar name={user.displayName} src={user.avatarUrl} size={32} />
            <span>{user.displayName}</span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
