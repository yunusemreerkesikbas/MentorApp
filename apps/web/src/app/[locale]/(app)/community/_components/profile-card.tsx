"use client";

import { useLocale, useTranslations } from "next-intl";
import Globe from "lucide-react/dist/esm/icons/globe.mjs";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@/i18n/navigation";
import { AuthorAvatar } from "./author-avatar";

/**
 * Right-column profile card — current user, modelled on Figma node 1:323 (avatar 64 + name 20px
 * bold + username/badge + bio block + meta line). No follower/website fields in our model; we map
 * to what `AuthUser` actually has (displayName, username, examType, email, createdAt).
 */
export function ProfileCard() {
  const t = useTranslations("community");
  const locale = useLocale();
  const { user } = useAuth();
  if (!user) return null;

  const memberSince = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(user.createdAt));

  const content = (
    <>
      <AuthorAvatar name={user.displayName} size={64} src={user.avatarUrl} />

      <div className="flex flex-col gap-2 py-2">
        <div className="flex flex-col gap-2">
          <p
            className="text-[20px] font-bold leading-[19px]"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {user.displayName}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-medium" style={{ color: "var(--color-main)" }}>
              {user.username ? `@${user.username}` : t("profile_no_username")}
            </p>
            {user.examType ? (
              <span
                className="rounded-[48px] px-3 py-[7px] text-[9px] font-medium leading-none"
                style={{ background: "#f5f5f5", color: "var(--color-secondary)" }}
              >
                {user.examType}
              </span>
            ) : null}
          </div>
        </div>
        <p className="text-[12px] font-medium leading-[19px]" style={{ color: "var(--color-main)" }}>
          {user.email}
        </p>
        {user.bio ? (
          <p
            className="line-clamp-3 whitespace-pre-line break-words text-[12px] leading-[18px]"
            style={{ color: "var(--color-secondary)" }}
          >
            {user.bio}
          </p>
        ) : null}
        {user.website ? (
          <span
            className="inline-flex w-fit items-center gap-1 text-[12px] font-medium"
            style={{ color: "var(--color-accent)" }}
          >
            <Globe size={12} aria-hidden="true" />
            {user.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </span>
        ) : null}
      </div>

      <p className="text-[13px] tracking-[-0.2px]" style={{ color: "var(--color-secondary)" }}>
        {t("profile_member_since", { date: memberSince })}
      </p>
    </>
  );

  // The whole card links to your own community profile — but only if you have a username (the route
  // is username-keyed); without one it renders plainly.
  return user.username ? (
    <Link
      href={{
        pathname: "/community/member/[username]",
        params: { username: user.username },
      }}
      className="-m-2 flex flex-col gap-4 rounded-2xl p-2 transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      {content}
    </Link>
  ) : (
    <div className="flex flex-col gap-4">{content}</div>
  );
}
