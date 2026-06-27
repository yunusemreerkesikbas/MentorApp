"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import type { PlanDto, SubscriptionView } from "@mentor/types";
import {
  ApiClientError,
  subscriptionsControllerCancel,
  subscriptionsControllerCheckout,
  subscriptionsControllerGetMine,
  subscriptionsControllerListPlans,
} from "@mentor/api-client";
import { Button, Card, Chip, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";

/** VAT-inclusive display (server sends minor units; this is pure display shaping). */
function formatPrice(minor: number, locale: string): string {
  return (minor / 100).toLocaleString(locale === "en" ? "en-GB" : "tr-TR", {
    style: "currency",
    currency: "TRY",
  });
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; plans: PlanDto[]; view: SubscriptionView };

/** Subscription hub — status, trial consent (§7), plan catalog, cancel. */
export function AbonelikShell() {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("subscription");
  const locale = useLocale();
  const { confirm, info } = useMentorDialog();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [view, setView] = useState<SubscriptionView | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      subscriptionsControllerListPlans(),
      subscriptionsControllerGetMine(),
    ])
      .then(([p, v]) => {
        if (!active) return;
        const plans = p as unknown as PlanDto[];
        const subscriptionView = v as unknown as SubscriptionView;
        setView(subscriptionView);
        setLoadState({ status: "ready", plans, view: subscriptionView });
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

  if (loadState.status === "loading") {
    return (
      <main className="mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-10">
        <p style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
      </main>
    );
  }

  if (loadState.status === "error") {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        <FormError message={loadState.message} />
      </main>
    );
  }

  const { plans } = loadState;
  const ent = view?.entitlement;
  const sub = view?.subscription;
  const hasOpenSub = Boolean(sub);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 lg:px-8 lg:py-10">
      <motion.header className="mb-6" {...headerMotion}>
        <h1
          className="text-3xl font-bold"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("title")}
        </h1>
        <p
          className="mt-1 text-base"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("subtitle")}
        </p>
      </motion.header>

      <motion.div className="flex flex-col gap-6" {...gridMotion}>
        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <Card>
            <SectionHeading
              as="h2"
              subtitle={ent?.isPremium ? t("status_premium") : t("status_free")}
            >
              {t("status_title")}
            </SectionHeading>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip>
                  {ent?.isPremium ? t("chip_premium") : t("chip_free")}
                </Chip>
                {sub?.cancelAtPeriodEnd ? (
                  <Chip>{t("chip_cancel")}</Chip>
                ) : null}
              </div>
              {ent?.isPremium && ent.validUntil ? (
                <p
                  className="text-sm"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("valid_until", {
                    date: new Date(ent.validUntil).toLocaleDateString(
                      locale === "en" ? "en-GB" : "tr-TR",
                      { dateStyle: "long" },
                    ),
                  })}
                </p>
              ) : null}
              {!ent?.isPremium ? (
                <p
                  className="text-sm"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("upgrade_prompt")}
                </p>
              ) : null}
              {hasOpenSub && !sub?.cancelAtPeriodEnd ? (
                <Button
                  onClick={() => void cancel()}
                  busy={busy}
                  className="!bg-white/60 !text-[var(--color-main)]"
                >
                  {t("cancel_button")}
                </Button>
              ) : null}
            </div>
          </Card>
        </motion.div>

        <FormError message={error} />

        {!hasOpenSub ? (
          <>
            <motion.div
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
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
                <span id="trial-consent-desc">{t("trial_consent")}</span>
              </label>
            </motion.div>

            <motion.div
              className="grid gap-4 sm:grid-cols-2"
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
              {plans.map((plan) => (
                <motion.div
                  key={plan.id}
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
                      {plan.name}
                    </p>
                    <p
                      className="text-2xl font-bold tabular-nums"
                      style={{ color: "var(--color-main)" }}
                    >
                      {formatPrice(plan.priceMinor, locale)}
                      <span
                        className="text-sm font-normal"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {" "}
                        {t("period_suffix", { months: plan.periodMonths })}
                      </span>
                    </p>
                    <p
                      className="text-sm"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {t("trial_days", { days: plan.trialDays })}
                    </p>
                    <Button
                      fullWidth
                      disabled={!consent}
                      busy={busy}
                      onClick={() => void checkout(plan)}
                    >
                      {t("start_trial")}
                    </Button>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </>
        ) : null}

        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <Link
            href="/panel"
            className="flex min-h-[44px] items-center justify-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("back_panel")}
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}
