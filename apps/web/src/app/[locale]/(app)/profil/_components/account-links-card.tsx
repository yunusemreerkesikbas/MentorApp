"use client";

import { useTranslations } from "next-intl";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import CreditCard from "lucide-react/dist/esm/icons/credit-card.mjs";
import LogOut from "lucide-react/dist/esm/icons/log-out.mjs";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import { Card, SectionHeading } from "@mentor/ui";
import { useAuth } from "@/lib/auth-context";

function ListRow({
  href,
  icon,
  onClick,
  children,
}: {
  href?: string;
  icon: ReactNode;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className =
    "flex min-h-[60px] w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border border-black/10 bg-white px-3 py-2 text-left transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";
  const style = { color: "var(--color-main)" };
  const label = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-progress-track)_45%,white)] text-[var(--color-progress)]">
        {icon}
      </span>
      <span
        className="text-base font-bold"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {children}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {label}
        <ChevronRight size={20} strokeWidth={2} aria-hidden />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {label}
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
      <div className="mt-4 flex flex-col gap-3">
        <ListRow href="/abonelik" icon={<CreditCard size={20} aria-hidden />}>
          {t("subscription")}
        </ListRow>
        <ListRow
          icon={<LogOut size={20} aria-hidden />}
          onClick={() => void logout()}
        >
          {t("logout")}
        </ListRow>
      </div>
    </Card>
  );
}
