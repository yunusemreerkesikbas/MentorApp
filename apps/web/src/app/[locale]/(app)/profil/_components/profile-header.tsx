"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, Chip } from "@mentor/ui";
import type { AuthUser } from "@mentor/types";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days.mjs";
import GraduationCap from "lucide-react/dist/esm/icons/graduation-cap.mjs";
import MailCheck from "lucide-react/dist/esm/icons/mail-check.mjs";
import MailWarning from "lucide-react/dist/esm/icons/mail-warning.mjs";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";

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
  const locale = useLocale();
  const joined = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(user.createdAt));

  return (
    <Card solid className="overflow-hidden p-0">
      <div
        className="h-20 rounded-[var(--radius-card)] bg-[linear-gradient(135deg,var(--color-main)_0%,var(--color-body)_56%,color-mix(in_srgb,var(--color-progress-track)_72%,white)_100%)] sm:h-24"
        aria-hidden
      />
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className="-mt-8 flex h-24 w-24 shrink-0 items-center justify-center rounded-[var(--radius-card)] border-4 border-white text-3xl font-bold shadow-[var(--shadow-card)] sm:-mt-10"
              style={{
                backgroundColor: "#D6DBFD",
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
              aria-hidden
            >
              {initials(user.displayName)}
            </div>
            <div className="min-w-0 sm:pt-3">
              <h2
                className="text-3xl font-semibold leading-tight text-balance"
                style={{
                  color: "var(--color-main)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {user.displayName}
              </h2>
              <p
                className="mt-1 truncate text-sm"
                style={{ color: "var(--color-secondary)" }}
              >
                {user.email}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {user.emailVerified ? (
                  <Chip className="inline-flex items-center gap-2 normal-case">
                    <MailCheck size={16} aria-hidden />
                    {t("email_verified")}
                  </Chip>
                ) : (
                  <Chip className="inline-flex items-center gap-2 normal-case">
                    <MailWarning size={16} aria-hidden />
                    {t("status_unverified")}
                  </Chip>
                )}
                <Chip className="inline-flex items-center gap-2 normal-case">
                  <Sparkles size={16} aria-hidden />
                  {t("status_active")}
                </Chip>
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div
            className="flex items-center gap-3 rounded-[var(--radius-card)] border border-black/10 bg-white px-4 py-3"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-progress-track)_45%,white)] text-[var(--color-progress)]">
              <GraduationCap size={20} aria-hidden />
            </span>
            <div>
              <dt className="text-sm font-bold text-[var(--color-secondary)]">
                {t("exam_label")}
              </dt>
              <dd className="text-base font-bold text-[var(--color-main)]">
                {user.examType ?? t("exam_empty")}
              </dd>
            </div>
          </div>
          <div
            className="flex items-center gap-3 rounded-[var(--radius-card)] border border-black/10 bg-white px-4 py-3"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-progress-track)_45%,white)] text-[var(--color-progress)]">
              <CalendarDays size={20} aria-hidden />
            </span>
            <div>
              <dt className="text-sm font-bold text-[var(--color-secondary)]">
                {t("member_since")}
              </dt>
              <dd className="text-base font-bold text-[var(--color-main)]">
                {joined}
              </dd>
            </div>
          </div>
        </dl>
      </div>
    </Card>
  );
}
