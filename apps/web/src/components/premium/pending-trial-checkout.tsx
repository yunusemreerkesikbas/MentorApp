"use client";

import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";

/** Resumes only the server's stored checkout; an ambiguous provider result starts nothing new. */
export function PendingTrialCheckout({ checkoutUrl }: { checkoutUrl: string | null }) {
  const t = useTranslations("subscription");
  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="text-sm text-[var(--color-secondary)]">
        {t(checkoutUrl ? "pending_trial_resume" : "pending_trial_unknown")}
      </p>
      {checkoutUrl ? (
        <Button onClick={() => window.location.assign(checkoutUrl)}>{t("continue_payment")}</Button>
      ) : (
        <Link href="/settings" className="flex min-h-11 items-center font-extrabold text-[var(--color-main)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">{t("pending_trial_support")}</Link>
      )}
    </div>
  );
}
