"use client";
import type { WeeklyRecapOfferDto } from "@mentor/types";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { PuhuImage } from "@/components/puhu-image";
import { Link } from "@/i18n/navigation";

export function WeeklyRecapAccessCard({ offer, busy, armed, error, onOpen, onPremium, onRefresh }: {
  offer: WeeklyRecapOfferDto; busy: boolean; armed: boolean; error: string | null;
  onOpen: () => void; onPremium: () => void; onRefresh: () => void;
}) {
  const t = useTranslations("analysis.recap.ownership");
  const format = useFormatter();
  const label = offer.mode === "COIN" ? armed ? "confirm" : "coin"
    : offer.mode === "EARNED" ? "earned" : offer.mode === "OWNED" ? "replay" : "open";
  return (
    <section aria-labelledby="recap-access-title" className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-card)]">
      <PuhuImage variant="premium" size={132} priority className="mx-auto" />
      <h1 id="recap-access-title" className="mt-4 text-3xl font-black text-[var(--color-main)]">{t("title")}</h1>
      <p className="mt-2 text-sm text-[var(--color-secondary)]">{offer.weekStart} · {offer.endDate}</p>
      <p className="mt-4 text-[var(--color-secondary)]">{t(offer.mode === "EARNED" ? "earned_detail" : "detail")}</p>
      {offer.mode === "COIN" ? <p className="mt-4 font-bold text-[var(--color-main)]">
        {t("allowance", { remaining: offer.coinRemaining, limit: offer.coinLimit, days: offer.windowDays })}
      </p> : null}
      {offer.nextAvailableAt && offer.coinRemaining === 0 && offer.mode === "COIN" ? <p className="mt-2 text-sm text-[var(--color-secondary)]">
        {t("next_available", { date: format.dateTime(new Date(offer.nextAvailableAt), { dateStyle: "medium", timeStyle: "short" }) })}
      </p> : null}
      {offer.message ? <p role="status" className="mt-4 text-[var(--color-secondary)]">{offer.message}</p> : null}
      {error ? <p role="alert" className="mt-4 text-[var(--color-secondary)]">{error}</p> : null}
      {offer.canOpen ? <Button className="mt-6 w-full" disabled={busy} aria-busy={busy || undefined} onClick={onOpen}>
        {busy ? t("preparing") : t(label, { cost: offer.cost })}
      </Button> : null}
      {!offer.canOpen ? <Button variant="secondary" className="mt-3 w-full" disabled={busy} onClick={onRefresh}>{t("refresh")}</Button> : null}
      {offer.premiumAvailable ? <Button variant="secondary" className="mt-3 w-full" disabled={busy} onClick={onPremium}>{t("premium")}</Button> : null}
      {offer.reason === "WEEKLY_RECAP_EMAIL_REQUIRED" ? <Link href="/settings" className="mt-4 inline-flex min-h-11 items-center underline">{t("verify")}</Link> : null}
      <p className="mt-4 text-sm text-[var(--color-secondary)]">{t("saved_detail")}</p>
      <Link href="/analysis" className="mt-3 inline-flex min-h-11 items-center font-bold underline">{t("statistics")}</Link>
    </section>
  );
}
