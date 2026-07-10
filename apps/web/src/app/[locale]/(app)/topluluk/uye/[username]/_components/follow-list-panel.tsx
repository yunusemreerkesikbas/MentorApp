"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { FollowUserRef } from "@mentor/types";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { getFollowers, getFollowing } from "@/lib/follow";
import { AuthorAvatar } from "../../../_components/author-avatar";
import { FollowButton } from "../../../_components/follow-button";

type FollowKind = "followers" | "following";
type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: FollowUserRef[]; nextCursor: string | null; loadingMore: boolean };

/**
 * A profile's follower / following list, shown in place of the activity feed (with a back link).
 * Each row links to the user's profile and carries a follow-back button (hidden on your own row).
 */
export function FollowListPanel({
  username,
  kind,
  onBack,
}: {
  username: string;
  kind: FollowKind;
  onBack: () => void;
}) {
  const t = useTranslations("topluluk");
  const { user } = useAuth();
  // The parent remounts this via key={kind}, so initial "loading" already resets on a followers↔following
  // switch — the effect only sets state asynchronously (no set-state-in-effect).
  const [state, setState] = useState<State>({ status: "loading" });
  const fetcher = kind === "followers" ? getFollowers : getFollowing;

  useEffect(() => {
    let active = true;
    fetcher(username)
      .then((res) => {
        if (active) setState({ status: "ready", items: res.items, nextCursor: res.nextCursor, loadingMore: false });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [username, kind]); // eslint-disable-line react-hooks/exhaustive-deps -- fetcher is derived from kind

  const loadMore = useCallback(() => {
    setState((s) => {
      if (s.status !== "ready" || !s.nextCursor || s.loadingMore) return s;
      fetcher(username, s.nextCursor)
        .then((res) =>
          setState((cur) =>
            cur.status === "ready"
              ? { ...cur, items: [...cur.items, ...res.items], nextCursor: res.nextCursor, loadingMore: false }
              : cur,
          ),
        )
        .catch(() =>
          setState((cur) => (cur.status === "ready" ? { ...cur, loadingMore: false } : cur)),
        );
      return { ...s, loadingMore: true };
    });
  }, [fetcher, username]);

  return (
    <div>
      <div className="flex items-center gap-2 border-b px-4 py-3 lg:px-6" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          className="inline-flex items-center gap-1 text-sm transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-secondary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h2 className="text-[15px] font-bold" style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}>
          {kind === "followers" ? t("followers_title") : t("following_title")}
        </h2>
      </div>

      {state.status === "loading" ? (
        <p className="px-4 py-12 text-center text-sm" style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
      ) : state.status === "error" ? (
        <p className="px-4 py-12 text-center text-sm" style={{ color: "var(--color-secondary)" }}>{t("error")}</p>
      ) : state.items.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm" style={{ color: "var(--color-secondary)" }}>{t("follow_list_empty")}</p>
      ) : (
        <>
          <ul className="divide-y divide-[rgba(0,0,0,0.06)]">
            {state.items.map((u) => (
              <li
                key={u.userId}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[rgba(0,0,0,0.03)] lg:px-6"
              >
                <Link
                  href={`/topluluk/uye/${u.username}`}
                  className="flex min-w-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
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
                {user?.id !== u.userId && (
                  <FollowButton username={u.username} initialFollowing={u.isFollowing} />
                )}
              </li>
            ))}
          </ul>
          {state.nextCursor && (
            <div className="my-6 flex justify-center">
              <Button variant="secondary" busy={state.loadingMore} onClick={loadMore}>
                {t("saved_load_more")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
