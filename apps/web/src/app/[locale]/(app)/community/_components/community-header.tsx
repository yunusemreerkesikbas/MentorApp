"use client";
import { Menu, MessageCircle } from "lucide-react";

import { useTranslations } from "next-intl";
import { NotificationBell } from "@mentor/ui";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { CircularBackLink } from "@/components/circular-back-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthorAvatar } from "./author-avatar";
import { CommunitySearch } from "./community-search";
import { useZoneDrawer } from "./zone-drawer-context";

export function CommunityHeader() {
  const t = useTranslations("community");
  const common = useTranslations("common");
  const { user } = useAuth();
  const pathname = usePathname();
  const { open, openDrawer, triggerRef } = useZoneDrawer();
  const isMemberProfile = pathname.startsWith("/community/member/");

  return (
    <header className="community-header">
      <div className="community-header__brand">
        <CircularBackLink
          href={isMemberProfile ? "/community" : "/dashboard"}
          label={isMemberProfile ? t("back") : common("dialog.close")}
          icon={isMemberProfile ? "chevron" : "close"}
        />
        <Link href="/community" className="community-header__wordmark community-header__wordmark--desktop">
          <span className="community-header__mark" aria-hidden>
            <MessageCircle size={17} strokeWidth={2.2} />
          </span>
          <span className="community-header__wordmark-label">{t("sidebar_title")}</span>
        </Link>
        <button
          ref={triggerRef}
          type="button"
          aria-label={t("drawer_open")}
          aria-controls="community-zone-drawer"
          aria-expanded={open}
          onClick={openDrawer}
          className="community-header__wordmark community-header__wordmark--mobile"
        >
          <span className="community-header__mark" aria-hidden>
            <Menu size={20} strokeWidth={2} />
          </span>
        </button>
      </div>

      <CommunitySearch />

      <div className="community-header__actions">
        <NotificationBell
          label={common("notifications_label")}
          unreadLabel={common("notifications_unread_label")}
          desktopSide="right"
        />
        <ThemeToggle />
        {user ? (
          <Link
            href={
              user.username
                ? {
                    pathname: "/community/member/[username]" as const,
                    params: { username: user.username },
                  }
                : "/settings"
            }
            className="community-header__profile"
          >
            <AuthorAvatar name={user.displayName} src={user.avatarUrl} size={32} />
            <span>{user.displayName}</span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
