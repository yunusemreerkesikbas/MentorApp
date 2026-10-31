"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import type { NotebookSlotView } from "@mentor/types";
import { Button, Modal, Skeleton } from "@mentor/ui";
import {
  fetchNotebookSlots,
  isEconomyDisabled,
  notifyEconomyChanged,
  purchaseNotebookSlot,
} from "@/lib/economy";
import { useEconomyEnabled } from "@/lib/use-economy-enabled";
import { disableEconomySnapshot } from "@/lib/economy-store";

/** Fetch the live quote only when requested; a failed purchase keeps its idempotency key. */
export function NotebookCapacityDialog({
  onClose,
  onPurchased,
  onPremium,
}: {
  onClose: () => void;
  onPurchased: () => Promise<void>;
  onPremium: () => void;
}) {
  const t = useTranslations("notebooks.capacity");
  const economyEnabled = useEconomyEnabled();
  const [view, setView] = useState<NotebookSlotView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const key = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!economyEnabled) return;
    fetchNotebookSlots()
      .then((result) => {
        if (active) setView(result);
      })
      .catch((err) => {
        if (!active) return;
        if (isEconomyDisabled(err)) {
          setClosed(true);
          disableEconomySnapshot();
        } else setError(t("load_error"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [economyEnabled, t]);

  async function syncPurchased() {
    setBusy(true);
    setError(null);
    try {
      await onPurchased();
    } catch {
      setError(t("sync_error"));
    } finally {
      setBusy(false);
    }
  }

  async function buy() {
    if (!view || busy || purchased) return;
    setBusy(true);
    setError(null);
    key.current ??= crypto.randomUUID();
    try {
      const result = await purchaseNotebookSlot(key.current, {
        expectedCost: view.cost,
        expectedPurchasedSlots: view.purchasedSlots,
      });
      setView(result);
      setPurchased(true);
      notifyEconomyChanged();
      // A failed collection refresh must never offer another debit for the same successful purchase.
      await syncPurchased();
    } catch (err) {
      if (isEconomyDisabled(err)) {
        setClosed(true);
        disableEconomySnapshot();
      } else if (err instanceof ApiClientError && err.status === 409) {
        setError(t("changed"));
        try {
          setView(await fetchNotebookSlots());
          key.current = null;
        } catch {
          setView(null);
          setError(t("load_error"));
        }
      } else if (err instanceof ApiClientError && err.status === 422) {
        setError(err.message);
        try {
          setView(await fetchNotebookSlots());
        } catch {
          setView(null);
        }
      } else setError(t("purchase_error"));
    } finally {
      setBusy(false);
    }
  }

  const showOffer = economyEnabled && !closed && !view?.premium;
  return (
    <Modal
      title={t("title")}
      closeLabel={t("close")}
      onClose={onClose}
      closeDisabled={busy}
      placement="sheet"
    >
      <div className="space-y-4">
        {loading && economyEnabled ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : null}
        {showOffer && view ? (
          <>
            <p>{t("description")}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("quotas")}
            </p>
            <p>{t("balance", { coin: view.coinConfirmed })}</p>
            {view.status === "LIMIT_REACHED" ? (
              <p>{t("limit")}</p>
            ) : (
              <>
                {!view.canAfford ? <p>{t("insufficient")}</p> : null}
                <Button
                  disabled={!view.canPurchase || busy || purchased}
                  onClick={() => void buy()}
                >
                  {purchased
                    ? t("purchased")
                    : busy
                      ? t("buying")
                      : t("buy", { cost: view.cost })}
                </Button>
              </>
            )}
          </>
        ) : null}
        {purchased ? (
          <Button disabled={busy} onClick={() => void syncPurchased()}>
            {t("sync")}
          </Button>
        ) : null}
        {(!loading || !economyEnabled) && !showOffer ? (
          <p>{t("premium_description")}</p>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            onClose();
            onPremium();
          }}
        >
          {t("premium")}
        </Button>
      </div>
    </Modal>
  );
}
