"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { PlanDto, PromotionOffersView, SubscriptionView } from "@mentor/types";
import {
  ApiClientError,
  subscriptionsControllerCancel,
  subscriptionsControllerCheckout,
  subscriptionsControllerGetMine,
  subscriptionsControllerListPlans,
} from "@mentor/api-client";
import { Button, Card, Chip, SkeletonGroup } from "@mentor/ui";
import { FormError } from "@/components/form";
import { LegalLink } from "@/components/legal-link";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { trackProductEvent } from "@/lib/analytics";
import { buildBeginCheckoutParams } from "@/lib/checkout-analytics";
import { fetchAutoPromotionOffers } from "@/lib/promotions";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import {
  COACH_RETURN_TO_STORAGE_KEY,
  safeInternalReturnTo,
} from "@/lib/community-coach-bridge";
import {
  SubscriptionSkeletonBlocks,
} from "./subscription-content-skeleton";
import {
  heroChipKey,
  listSubscriptionFacts,
  type SubscriptionFact,
  type SubscriptionFactId,
} from "./subscription-facts";

const FACT_LABEL: Record<
  SubscriptionFactId,
  | "row_price"
  | "row_billing"
  | "row_started"
  | "row_trial_ends"
  | "row_period_start"
  | "row_next_renewal"
  | "row_access_ends"
  | "row_renewal"
> = {
  price: "row_price",
  billing: "row_billing",
  started: "row_started",
  trial_ends: "row_trial_ends",
  period_start: "row_period_start",
  next_renewal: "row_next_renewal",
  access_ends: "row_access_ends",
  renewal: "row_renewal",
};

const compactButtonClass = "!min-h-11 !px-4 !py-2 !text-sm";

/** VAT-inclusive display (server sends minor units; this is pure display shaping). */
function formatPrice(minor: number, locale: string): string {
  return (minor / 100).toLocaleString(locale === "en" ? "en-GB" : "tr-TR", {
    style: "currency",
    currency: "TRY",
  });
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", {
    dateStyle: "long",
  });
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      plans: PlanDto[];
      view: SubscriptionView;
      offers: PromotionOffersView | null;
    };

/** Subscription hub — facts list, trial consent (§7), plan catalog, cancel. */
export function SubscriptionShell() {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("subscription");
  const tPaywall = useTranslations("paywall");
  const tLegal = useTranslations("legal");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { confirm, info } = useMentorDialog();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [view, setView] = useState<SubscriptionView | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const requestedReturn = searchParams.get("returnTo");
    if (!requestedReturn) return;
    window.sessionStorage.setItem(
      COACH_RETURN_TO_STORAGE_KEY,
      safeInternalReturnTo(requestedReturn),
    );
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    Promise.all([
      subscriptionsControllerListPlans(),
      subscriptionsControllerGetMine(),
      fetchAutoPromotionOffers(),
    ])
      .then(([p, v, offers]) => {
        if (!active) return;
        const plans = p as unknown as PlanDto[];
        const subscriptionView = v as unknown as SubscriptionView;
        setView(subscriptionView);
        setLoadState({
          status: "ready",
          plans,
          view: subscriptionView,
          offers,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadState({
          status: "error",
          message:
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err),
        });
      });
    return () => {
      active = false;
    };
  }, []);

  async function checkout(plan: PlanDto) {
    setError(null);
    setBusy(true);
    const offer =
      loadState.status === "ready" ? loadState.offers?.offers[plan.id] : undefined;
    trackProductEvent(
      "begin_checkout",
      buildBeginCheckoutParams(plan, offer?.chargedPriceMinor),
    );
    try {
      const session = (await subscriptionsControllerCheckout({
        planId: plan.id,
      })) as unknown as {
        checkoutUrl: string;
      };
      window.location.assign(session.checkoutUrl);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err),
      );
      setBusy(false);
    }
  }

  async function cancel() {
    const ok = await confirm({
      title: t("cancel_confirm_title"),
      message: t("cancel_confirm_message"),
      confirmLabel: t("cancel_confirm_yes"),
      cancelLabel: t("cancel_confirm_no"),
    });
    if (!ok) return;

    setError(null);
    setBusy(true);
    try {
      const updated =
        (await subscriptionsControllerCancel()) as unknown as SubscriptionView;
      setView(updated);
      if (loadState.status === "ready") {
        setLoadState({
          status: "ready",
          plans: loadState.plans,
          view: updated,
          offers: loadState.offers,
        });
      }
      await info({
        title: t("cancel_success_title"),
        message: t("cancel_success_message"),
        okLabel: t("cancel_success_ok"),
      });
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setBusy(false);
    }
  }

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" as const },
        },
      };

  const gridMotion = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: staggerListVariants,
      };

  if (loadState.status === "error") {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        <FormError message={loadState.message} />
      </main>
    );
  }

  const loading = loadState.status === "loading";
  const plans = loadState.status === "ready" ? loadState.plans : [];
  const purchaseEnabled = plans.some((plan) => plan.purchaseEnabled);
  const ent = view?.entitlement;
  const sub = view?.subscription;
  const hasOpenSub = Boolean(sub);
  const plan = sub ? (plans.find((item) => item.id === sub.planId) ?? null) : null;
  const discount = view?.discount ?? null;
  const facts = listSubscriptionFacts({
    entitlement: ent,
    subscription: sub,
    plan,
    discount,
  });
  const reason = ent?.reason ?? "NONE";
  const heroTitle = plan?.name ?? (ent?.isPremium ? t("chip_premium") : t("chip_free"));
  const canCancel = hasOpenSub && !sub?.cancelAtPeriodEnd;
  const showSummary = facts.length > 0 || canCancel || reason !== "NONE";
  const heroChip = heroChipKey(reason, Boolean(sub?.cancelAtPeriodEnd));

  function factValue(fact: SubscriptionFact): string {
    switch (fact.id) {
      case "price":
        return fact.priceMinor == null ? "—" : formatPrice(fact.priceMinor, locale);
      case "billing":
        return fact.periodMonths === 1
          ? t("billing_monthly")
          : t("billing_months", { months: fact.periodMonths ?? 0 });
      case "started":
      case "trial_ends":
      case "period_start":
      case "next_renewal":
      case "access_ends":
        return fact.iso ? formatDate(fact.iso, locale) : "—";
      case "renewal":
        return fact.renewal === "stops" ? t("renewal_stops") : t("renewal_auto");
    }
  }

  const readyBody = loading ? (
    <div className="min-h-[22rem]" aria-hidden />
  ) : (
    <motion.div className="flex flex-col gap-6" {...headerMotion} {...gridMotion}>
        {showSummary ? (
        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p
                  className="text-balance text-lg font-bold"
                  style={{
                    color: "var(--color-main)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {heroTitle}
                </p>
                {plan ? (
                  <>
                    {discount ? (
                      <p className="mt-1 text-xs font-semibold">
                        <span className="sr-only">{tPaywall("price_before")}: </span>
                        <s
                          className="tabular-nums"
                          style={{ color: "var(--color-secondary)" }}
                        >
                          {formatPrice(discount.listPriceMinor, locale)}
                        </s>
                      </p>
                    ) : null}
                    <p
                      className={`text-2xl font-bold tabular-nums ${discount ? "mt-0.5" : "mt-1"}`}
                      style={{ color: "var(--color-main)" }}
                    >
                      {formatPrice(discount?.chargedPriceMinor ?? plan.priceMinor, locale)}
                      <span
                        className="text-sm font-normal"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {" "}
                        {t("period_suffix", { months: plan.periodMonths })}
                      </span>
                    </p>
                    {discount ? (
                      <p
                        className="mt-1 text-xs"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {t("discount_remaining", { periods: discount.periodsRemaining })}
                        {" · "}
                        {t("discount_renewal_after", {
                          price: formatPrice(discount.listPriceMinor, locale),
                        })}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
              {heroChip ? (
                <Chip size="sm" className="!normal-case">
                  {t(heroChip)}
                </Chip>
              ) : null}
            </div>

            {facts.length > 0 ? (
              <dl className="mt-6 flex flex-col">
                {facts.map((fact) => (
                  <FactRow
                    key={fact.id}
                    label={t(FACT_LABEL[fact.id])}
                    value={factValue(fact)}
                  />
                ))}
              </dl>
            ) : null}

            {canCancel ? (
              <div className="mt-5">
                <Button
                  variant="secondary"
                  onClick={() => void cancel()}
                  busy={busy}
                  className={compactButtonClass}
                >
                  {t("cancel_button")}
                </Button>
              </div>
            ) : null}
          </Card>
        </motion.div>
        ) : null}

        <FormError message={error} />

        {!hasOpenSub ? (
          <>
            <motion.div
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
              {purchaseEnabled ? (
                <label
                  className="flex min-h-[44px] items-start gap-3 rounded-[var(--radius-card)] text-sm leading-relaxed"
                  style={{ color: "var(--color-body)" }}
                >
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 rounded accent-[var(--color-btn)]"
                    aria-describedby="trial-consent-desc"
                  />
                  <span id="trial-consent-desc">
                    {t("trial_consent")}
                    {/* Distance-selling rules want the contract + pre-sale form reachable BEFORE
                        the charge, not buried in a footer. */}
                    <span className="mt-2 block" style={{ color: "var(--color-secondary)" }}>
                      <LegalLink slug="mesafeli-satis-sozlesmesi">
                        {tLegal("consent_distance_sales")}
                      </LegalLink>
                      {" · "}
                      <LegalLink slug="on-bilgilendirme-formu">
                        {tLegal("consent_pre_info")}
                      </LegalLink>{" "}
                      {tLegal("consent_confirm")}
                    </span>
                  </span>
                </label>
              ) : (
                <Card>
                  <div className="flex flex-col items-start gap-3">
                    <Chip className="!normal-case">{t("chip_unavailable")}</Chip>
                    <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                      {t("payments_coming_soon")}
                    </p>
                  </div>
                </Card>
              )}
            </motion.div>

            <motion.div
              // One plan must not sit in a half-width column (the catalog is monthly-only today).
              className={`grid gap-4 ${plans.length > 1 ? "sm:grid-cols-2" : ""}`}
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
              {plans.map((catalogPlan) => (
                <motion.div
                  key={catalogPlan.id}
                  variants={reduceMotion ? undefined : staggerItemVariants}
                >
                  <Card className="flex h-full flex-col gap-3">
                    <p
                      className="text-lg font-bold"
                      style={{
                        color: "var(--color-main)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {catalogPlan.name}
                    </p>
                    <p
                      className="text-2xl font-bold tabular-nums"
                      style={{ color: "var(--color-main)" }}
                    >
                      {formatPrice(catalogPlan.priceMinor, locale)}
                      <span
                        className="text-sm font-normal"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {" "}
                        {t("period_suffix", { months: catalogPlan.periodMonths })}
                      </span>
                    </p>
                    <p
                      className="text-sm"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {t("trial_days", { days: catalogPlan.trialDays })}
                    </p>
                    <Button
                      disabled={!catalogPlan.purchaseEnabled || !consent}
                      busy={busy}
                      onClick={() => void checkout(catalogPlan)}
                      className={compactButtonClass}
                    >
                      {t(catalogPlan.purchaseEnabled ? "start_trial" : "coming_soon")}
                    </Button>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </>
        ) : null}
      </motion.div>
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 lg:px-8 lg:py-10">
      <h1 className="sr-only">{t("title")}</h1>
      <SkeletonGroup label={t("loading")} loading={loading} revealed={readyBody}>
        <SubscriptionSkeletonBlocks />
      </SkeletonGroup>
    </main>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0"
      style={{
        borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
      }}
    >
      <dt className="shrink-0 text-sm" style={{ color: "var(--color-secondary)" }}>
        {label}
      </dt>
      <dd
        className="min-w-0 truncate text-right text-sm font-medium tabular-nums"
        style={{ color: "var(--color-main)" }}
      >
        {value}
      </dd>
    </div>
  );
}
