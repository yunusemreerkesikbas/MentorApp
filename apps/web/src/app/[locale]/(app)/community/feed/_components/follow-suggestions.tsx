"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { FollowUserRef } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { getFollowSuggestions } from "@/lib/follow";
import { AuthorAvatar } from "../../_components/author-avatar";
import { FollowButton } from "../../_components/follow-button";

/**
 * "Kimi takip et" — seeds the Akış feed by surfacing people to follow (active authors in your zones +
 * cohort fallback). Self-hides when there are no suggestions. Following someone triggers `onFollowed`
 * so the parent can refetch the feed; the card stays (server drops it on the next visit).
 */
export function FollowSuggestions({ onFollowed }: { onFollowed?: () => void }) {
  const t = useTranslations("community");
  const [items, setItems] = useState<FollowUserRef[] | null>(null);

  useEffect(() => {
    let active = true;
    getFollowSuggestions()
      .then((res) => {
        if (active) setItems(res);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Silent while loading; hidden entirely when there's nothing to suggest.
  if (!items || items.length === 0) return null;

  return (
    <section
      className="border-b px-4 py-4 lg:px-6"
      style={{ borderColor: "var(--color-border)" }}
      aria-label={t("suggestions_title")}
    >
      <h2 className="mb-3 text-[13px] font-semibold uppercase" style={{ color: "var(--color-secondary)", letterSpacing: "0.06em" }}>
        {t("suggestions_title")}
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((u) => (
          <li key={u.userId} className="flex items-center justify-between gap-3">
            <Link
              href={{
                pathname: "/community/member/[username]",
                params: { username: u.username },
              }}
              className="flex min-w-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <AuthorAvatar name={u.displayName} size={40} src={u.avatarUrl} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold" style={{ color: "var(--color-main)" }}>
                  {u.displayName}
                </span>
                <span className="block truncate text-[12px]" style={{ color: "var(--color-secondary)" }}>
                  @{u.username}
                </span>
              </span>
            </Link>
            <FollowButton
              username={u.username}
              initialFollowing={u.isFollowing}
              onChange={(following) => following && onFollowed?.()}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
