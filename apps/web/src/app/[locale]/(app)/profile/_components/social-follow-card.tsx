"use client";
import { ExternalLink } from "lucide-react";

import { useTranslations } from "next-intl";
import { Card, SectionHeading } from "@mentor/ui";
import { getProfileLinks } from "@/lib/profile-links";

export function SocialFollowCard() {
  const t = useTranslations("profile.social");
  const links = getProfileLinks().social;

  if (links.length === 0) return null;

  return (
    <Card solid className="p-4">
      <SectionHeading subtitle={t("subtitle")}>{t("title")}</SectionHeading>
      <div className="mt-3 divide-y divide-black/10 overflow-hidden rounded-[var(--radius-card)]">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[60px] min-w-0 items-center justify-between gap-3 bg-white px-3 py-2 transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-card)] text-sm font-bold text-[var(--color-main)]">
                {link.shortLabel}
              </span>
              <span className="truncate text-sm font-bold text-[var(--color-main)]">
                {link.label}
              </span>
            </span>
            <ExternalLink
              size={16}
              className="shrink-0 text-[var(--color-secondary)]"
              aria-hidden
            />
          </a>
        ))}
      </div>
    </Card>
  );
}
