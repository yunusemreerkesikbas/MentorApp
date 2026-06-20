"use client";

import { useTranslations } from "next-intl";
import { Chip } from "@mentor/ui";
import type { AuthUser } from "@mentor/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Profile identity row — Nuton thumb placeholder (#D6DBFD) + League Spartan name stack.
 */
export function ProfileHeader({ user }: { user: AuthUser }) {
  const t = useTranslations("profile");

  return (
    <div className="flex items-center gap-4">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-card)] text-xl font-bold"
        style={{
          backgroundColor: "#D6DBFD",
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
        aria-hidden
      >
        {initials(user.displayName)}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h2
          className="text-xl font-semibold leading-tight"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {user.displayName}
        </h2>
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {user.email}
        </p>
        {user.emailVerified ? (
          <Chip className="mt-1">{t("email_verified")}</Chip>
        ) : (
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("email_not_verified")}
          </p>
        )}
      </div>
    </div>
  );
}
