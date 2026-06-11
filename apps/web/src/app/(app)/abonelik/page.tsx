"use client";

import { useEffect, useState } from "react";
import type { PlanDto, SubscriptionView } from "@mentor/types";
import {
  subscriptionsControllerCancel,
  subscriptionsControllerCheckout,
  subscriptionsControllerGetMine,
  subscriptionsControllerListPlans,
} from "@mentor/api-client";
import { Button, Card, Chip } from "@mentor/ui";
import { FormError } from "../../../components/form";

/** VAT-inclusive display (server sends minor units; this is pure display shaping). */
function formatPrice(minor: number): string {
  return (minor / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

export default function AbonelikPage() {
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [view, setView] = useState<SubscriptionView | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Inline external calls (react-compiler: no local setState closures invoked in the effect body).
    Promise.all([subscriptionsControllerListPlans(), subscriptionsControllerGetMine()])
      .then(([p, v]) => {
        setPlans(p as unknown as PlanDto[]);
        setView(v as unknown as SubscriptionView);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Bir hata oluştu."));
  }, []);

  async function checkout(plan: PlanDto) {
    setError(null);
    setBusy(true);
    try {
      const session = (await subscriptionsControllerCheckout({ planId: plan.id })) as unknown as {
        checkoutUrl: string;
      };
      window.location.assign(session.checkoutUrl); // provider-hosted page (fake: internal)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm("Aboneliğin dönem sonunda sona erecek. Emin misin?")) return;
    setError(null);
    setBusy(true);
    try {
      setView((await subscriptionsControllerCancel()) as unknown as SubscriptionView);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  const ent = view?.entitlement;
  const sub = view?.subscription;
  const hasOpenSub = Boolean(sub);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10">
      <h1
        className="text-3xl font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        Abonelik
      </h1>

      {/* Current status */}
      <Card>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Chip>{ent?.isPremium ? "Premium" : "Ücretsiz"}</Chip>
            {sub?.cancelAtPeriodEnd && <Chip>Dönem sonunda iptal</Chip>}
          </div>
          {ent?.isPremium && ent.validUntil && (
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              Erişimin{" "}
              {new Date(ent.validUntil).toLocaleDateString("tr-TR", { dateStyle: "long" })}{" "}
              tarihine kadar geçerli.
            </p>
          )}
          {!ent?.isPremium && (
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              Premium ile AI koç, deneme yorumları ve foto analizi açılır.
            </p>
          )}
          {hasOpenSub && !sub?.cancelAtPeriodEnd && (
            <Button onClick={() => void cancel()} busy={busy}>
              Aboneliği iptal et
            </Button>
          )}
        </div>
      </Card>

      <FormError message={error} />

      {/* Plan catalog — only when there is no open subscription */}
      {!hasOpenSub && (
        <>
          <label className="flex items-start gap-2 text-sm" style={{ color: "var(--color-body)" }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            {/* Explicit trial consent copy (§7 — mandatory before checkout). */}
            <span>
              7 gün ücretsiz deneme sonrası seçtiğim planın ücreti kartımdan otomatik tahsil
              edilir; istediğim an iptal edebilirim. Bunu anladım ve onaylıyorum.
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <Card key={plan.id} className="flex flex-col gap-3">
                <p
                  className="text-lg font-bold"
                  style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                >
                  {plan.name}
                </p>
                <p className="text-2xl font-bold" style={{ color: "var(--color-main)" }}>
                  {formatPrice(plan.priceMinor)}
                  <span className="text-sm font-normal" style={{ color: "var(--color-secondary)" }}>
                    {" "}
                    / {plan.periodMonths} ay · KDV dahil
                  </span>
                </p>
                <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                  {plan.trialDays} gün ücretsiz deneme
                </p>
                <Button
                  fullWidth
                  disabled={!consent}
                  busy={busy}
                  onClick={() => void checkout(plan)}
                >
                  Denemeyi başlat
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
