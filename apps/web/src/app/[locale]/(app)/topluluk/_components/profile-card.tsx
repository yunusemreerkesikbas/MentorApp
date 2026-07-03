"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { AuthorAvatar } from "./author-avatar";

/**
 * Right-column profile card — current user, modelled on Figma node 1:323 (avatar 64 + name 20px
 * bold + username/badge + bio block + meta line). No follower/website fields in our model; we map
 * to what `AuthUser` actually has (displayName, username, examType, email, createdAt).
 */
export function ProfileCard() {
  const t = useTranslations("topluluk");
  const locale = useLocale();
  const { user } = useAuth();
  if (!user) return null;

  const memberSince = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(user.createdAt));

  return (
    <div className="flex flex-col gap-4">
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
      </div>

      <p className="text-[13px] tracking-[-0.2px]" style={{ color: "var(--color-secondary)" }}>
        {t("profile_member_since", { date: memberSince })}
      </p>
    </div>
  );
}
