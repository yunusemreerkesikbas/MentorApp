"use client";
import { ChevronDown, MessageCircle, Search, X } from "lucide-react";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { NotificationBell } from "@mentor/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { AuthorAvatar } from "./author-avatar";

export function CommunityHeader() {
  const t = useTranslations("community");
  const common = useTranslations("common");
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    router.push(
      normalized
        ? { pathname: "/community/feed", query: { q: normalized } }
        : "/community/feed",
    );
  };

  return (
    <header className="community-header">
      <div className="community-header__brand">
        <Link href="/dashboard" className="community-header__exit" aria-label="Mentor">
          <X size={20} aria-hidden />
        </Link>
        <Link href="/community" className="community-header__wordmark">
          <span className="community-header__mark" aria-hidden>
            <MessageCircle size={17} strokeWidth={2.2} />
          </span>
          <span className="community-header__wordmark-label">{t("sidebar_title")}</span>
        </Link>
      </div>

      <form className="community-header__search" role="search" onSubmit={submitSearch}>
        <Search size={18} aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("global_search_placeholder")}
          aria-label={t("global_search_placeholder")}
        />
      </form>

      <div className="community-header__actions">
        <NotificationBell
          label={common("notifications_label")}
          unreadLabel={common("notifications_unread_label")}
        />
        {user ? (
          <Link href="/profile" className="community-header__profile">
            <AuthorAvatar name={user.displayName} src={user.avatarUrl} size={32} />
            <span>{user.displayName}</span>
            <ChevronDown size={15} aria-hidden />
          </Link>
        ) : null}
      </div>
    </header>
  );
}
