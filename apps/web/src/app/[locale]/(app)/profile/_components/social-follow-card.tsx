"use client";
import { ExternalLink } from "lucide-react";

import { useTranslations } from "next-intl";
import { Card } from "@mentor/ui";
import { getProfileLinks } from "@/lib/profile-links";

export function SocialFollowCard() {
  const t = useTranslations("profile.social");
  const links = getProfileLinks().social;

  if (links.length === 0) return null;

  return (
    <Card solid className="p-2 sm:p-2.5">
      <div className="px-2 pt-1 pb-1.5">
        <h2
          className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {t("title")}
        </h2>
      </div>
      <div className="flex flex-col gap-0.5">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="group flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-[calc(var(--radius-card)-2px)] px-3 py-1.5 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] text-xs font-semibold text-[var(--color-main)]">
                {link.shortLabel}
              </span>
              <span
                className="truncate text-sm font-medium text-[var(--color-main)]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {link.label}
              </span>
            </span>
            <ExternalLink
              size={15}
              className="shrink-0 text-[var(--color-secondary)]/60 transition-colors group-hover:text-[var(--color-secondary)]"
              aria-hidden
            />
          </a>
        ))}
      </div>
    </Card>
  );
}
