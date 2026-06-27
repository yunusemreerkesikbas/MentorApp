"use client";

import { useTranslations } from "next-intl";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import { Card, SectionHeading } from "@mentor/ui";
import { useAuth } from "@/lib/auth-context";

function ListRow({
  href,
  onClick,
  children,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className =
    "flex min-h-[56px] w-full items-center justify-between gap-3 rounded-[var(--radius-card)] px-3 py-2 text-left transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none";
  const style = { color: "var(--color-main)" };

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        <span
          className="text-base font-medium"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {children}
        </span>
        <ChevronRight size={20} strokeWidth={2} aria-hidden />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      <span
        className="text-base font-medium"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {children}
      </span>
      <ChevronRight size={20} strokeWidth={2} aria-hidden />
    </button>
  );
}

/** Nuton list-item rows (335×56) — account shortcuts. */
export function AccountLinksCard() {
  const t = useTranslations("profile.account");
  const { logout } = useAuth();

  return (
    <Card>
      <SectionHeading>{t("title")}</SectionHeading>
      <div className="mt-4 flex flex-col gap-1">
        <ListRow href="/abonelik">{t("subscription")}</ListRow>
        <ListRow onClick={() => void logout()}>{t("logout")}</ListRow>
      </div>
    </Card>
  );
}
