"use client";
import Image from "next/image";
import type { WeeklyRecapOfferDto } from "@mentor/types";
import { Clock3, Gift } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { PuhuImage } from "@/components/puhu-image";
import { UNLOCK_GLYPH, UnlockCaption, UnlockChoice, UnlockRow, type UnlockCoin } from "@/components/unlock-choice";
import { Link } from "@/i18n/navigation";
import { useAppAvailability } from "@/lib/app-availability";
import { useSubscription } from "@/lib/subscription-context";
import { recapAccessView } from "./weekly-recap-access-view";

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** The locked weekly story: its own cover (free basic numbers), then how to open it. */
export function WeeklyRecapAccessCard({ offer, busy, armed, error, onOpen, onPremium, onCancel, onRetry }: {
  offer: WeeklyRecapOfferDto; busy: boolean; armed: boolean; error: string | null;
  onOpen: () => void; onPremium: () => void; onCancel: () => void; onRetry: () => void;
}) {
  const t = useTranslations("analysis.recap.ownership");
  const format = useFormatter();
  const purchases = useAppAvailability()?.studentPurchases ?? false;
  const trial = useSubscription().view?.trialEligibility;
  const view = recapAccessView(offer, purchases);
  const { coinConfirmed: balance, cost, coinLimit: limit, coinRemaining: remaining, windowDays: days } = offer;
  const premiumCta = trial && (trial.eligible || trial.reason === "PHONE_REQUIRED") ? t("trial") : t("premium_more");

  const coin: UnlockCoin | null = view.kind !== "choice" || !view.coin ? null : {
    title: view.coin === "limit" ? t("limit_title", { limit }) : t("coin_title", { cost }),
    count: view.coin === "ready" ? t("balance", { balance }) : view.coin === "short" ? `${balance}/${cost}` : undefined,
    progress: view.coin === "short" ? { value: balance, max: cost, label: t("coin_progress") } : undefined,
    pips: view.coin === "short" ? undefined
      : { limit, remaining, label: t("allowance_label", { days, limit, remaining }), text: t("allowance", { days, limit }) },
    caption: view.coin === "ready" ? t("coin_ready", { remaining })
      : view.coin === "short" ? t("coin_short", { missing: view.missing })
      : offer.nextAvailableAt ? t("next_available", { date: format.dateTime(new Date(offer.nextAvailableAt), { day: "numeric", month: "long" }) })
      : undefined,
    cta: t("coin", { cost }),
    howTo: view.coin === "short" ? { href: { pathname: "/profile", hash: "coin" }, label: t("coin_how") } : undefined,
    onArm: onOpen,
  };
  const confirming = armed && view.kind === "choice" && view.coin === "ready";

  return (
    <>
      <section aria-labelledby="recap-access-title" className="weekly-recap-theme overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="relative h-[212px] overflow-hidden bg-[var(--recap-coral)] p-5 text-[var(--recap-ink)]">
          <Image src="/visuals/weekly-recap-2023/graphics.png" alt="" width={230} height={177} priority
            className="pointer-events-none absolute -right-[54px] -top-[26px] w-[230px] opacity-90" />
          <h1 id="recap-access-title" className="relative text-micro font-black tracking-[0.08em]">{t("eyebrow")}</h1>
          <p className="relative mt-4 text-section font-black leading-[1.02] tabular-nums">
            <span className="block">{t("days", { count: offer.teaser.activeDays })}</span>
            {offer.teaser.focusMinutes > 0 ? <span className="block">{t("minutes", { count: offer.teaser.focusMinutes })}</span> : null}
          </p>
          {/* Wraps before Puhu instead of running under it. */}
          <p className={`relative mt-3 text-sm font-extrabold ${view.kind === "member" ? "pr-32" : "pr-28"}`}>
            {format.dateTimeRange(utc(offer.weekStart), utc(offer.endDate), { day: "numeric", month: "long", timeZone: "UTC" })}
            {offer.teaser.topSubject ? ` · ${t("top_subject", { subject: offer.teaser.topSubject })}` : null}
          </p>
          <div className={`absolute ${view.kind === "member" ? "-bottom-1.5 -right-1" : "-bottom-2 right-2.5"}`}>
            <PuhuImage variant={view.kind === "member" ? "premium" : "happy"} size={view.kind === "member" ? 150 : 112} priority />
          </div>
        </div>

        <div className="p-5">
          {view.kind === "gift" || view.kind === "choice" ? (
            <p className="mb-4 text-body-sm font-bold text-[var(--color-main)]">{t("intro")}</p>
          ) : null}
          {error ? <p role="alert" className="mb-4 text-caption font-semibold text-[var(--color-danger)]">{error}</p> : null}

          {view.kind === "gift" ? (
            <UnlockRow as="h2" title={t("gift_title")} icon={<Gift className={`${UNLOCK_GLYPH} text-[var(--recap-coral)]`} strokeWidth={1.9} aria-hidden />}>
              <UnlockCaption>{t("gift_detail")}</UnlockCaption>
              <Button fullWidth busy={busy} onClick={onOpen}>{busy ? t("preparing") : t("earned")}</Button>
            </UnlockRow>
          ) : view.kind === "member" ? (
            <UnlockRow as="h2" flush title={t("member_title")} aside={<PremiumBadge />}>
              <UnlockCaption>{t("member_detail")}</UnlockCaption>
              <Button fullWidth busy={busy} onClick={onOpen}>{busy ? t("preparing") : t("open")}</Button>
            </UnlockRow>
          ) : view.kind === "owned" ? (
            <Button fullWidth busy={busy} onClick={onOpen}>{t("replay")}</Button>
          ) : view.kind === "retry" ? (
            <div role="status">
              <UnlockRow as="h2" flush title={t("unavailable_title")} icon={<Clock3 className={`${UNLOCK_GLYPH} text-[var(--color-secondary)]`} strokeWidth={1.9} aria-hidden />}>
                <UnlockCaption>{t("unavailable_detail")}</UnlockCaption>
                <Button variant="secondary" fullWidth busy={busy} onClick={onRetry}>{t("retry")}</Button>
              </UnlockRow>
            </div>
          ) : view.kind === "notice" ? (
            <p role="status" className="text-body-sm font-semibold text-[var(--color-secondary)]">{view.message}</p>
          ) : (
            <UnlockChoice heading={t("choose")} lead={view.lead} busy={busy} coin={coin}
              premium={view.premium && !confirming ? { title: t("premium_title"), caption: t("premium_detail"),
                cta: view.lead === "premium" ? premiumCta : t("premium_more"), onSelect: onPremium } : null}
              confirm={confirming ? { title: t("coin_title", { cost }), lead: t("confirm_lead"), from: String(balance),
                to: t("coin_amount", { amount: balance - cost }), note: t("confirm_note", { days, limit }),
                confirm: busy ? t("preparing") : t("confirm"), cancel: t("cancel"), onConfirm: onOpen, onCancel } : null} />
          )}

          {view.kind !== "notice" ? (
            <p className="mt-3.5 text-center text-caption font-semibold text-[var(--color-secondary)]">
              {t(view.kind === "gift" ? "gift_saved" : view.kind === "member" ? "member_saved"
                : view.kind === "retry" ? "archive_waiting" : "saved_detail")}
            </p>
          ) : null}
        </div>
      </section>
      <div className="mt-2 flex justify-center">
        <Link href="/analysis" className="inline-flex min-h-11 items-center text-sm font-extrabold text-[var(--color-main)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">{t("statistics")}</Link>
      </div>
    </>
  );
}
