"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Card, SectionHeading } from "@mentor/ui";
import { useAuth } from "../../../../lib/auth-context";

function ChevronIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

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
        <span className="text-base font-medium" style={{ fontFamily: "var(--font-body)" }}>
          {children}
        </span>
        <ChevronIcon />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      <span className="text-base font-medium" style={{ fontFamily: "var(--font-body)" }}>
        {children}
      </span>
      <ChevronIcon />
    </button>
  );
}

/** Nuton list-item rows (335×56) — account shortcuts. */
export function AccountLinksCard() {
  const { logout } = useAuth();

  return (
    <Card>
      <SectionHeading>Hesap</SectionHeading>
      <div className="mt-4 flex flex-col gap-1">
        <ListRow href="/abonelik">Abonelik</ListRow>
        <ListRow onClick={() => void logout()}>Çıkış yap</ListRow>
      </div>
    </Card>
  );
}
