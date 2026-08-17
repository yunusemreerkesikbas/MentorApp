"use client";

import { useTranslations } from "next-intl";
import { Card } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Shown when editorial countdown data is missing — guides user to Profil or explains seed gap.
 */
export function CountdownPlaceholder() {
  const { user } = useAuth();
  const translate = useTranslations("countdown");
  const hasExamType = Boolean(user?.examType);

  return (
    <Card>
      <p
        className="text-base font-bold"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {translate("title")}
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
        {hasExamType ? translate("no_calendar") : translate("no_exam_type")}
      </p>
      {!hasExamType ? (
        <Link
          href="/settings"
          className="mt-4 flex min-h-[44px] w-fit items-center rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{
            backgroundColor: "var(--color-btn)",
            color: "var(--color-btn-label)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        >
          {translate("select_exam")}
        </Link>
      ) : null}
    </Card>
  );
}
