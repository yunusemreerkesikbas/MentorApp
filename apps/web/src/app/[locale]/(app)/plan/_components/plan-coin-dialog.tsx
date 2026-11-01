"use client";

import { useLayoutEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";

/** Explicit confirmation above the native wizard dialog; never triggered by navigation. */
export function PlanCoinDialog({
  cost,
  message,
  canConfirm,
  onConfirm,
  onClose,
  onPremium,
}: {
  cost: number | null;
  message?: string;
  canConfirm: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onPremium?: () => void;
}) {
  const t = useTranslations("plan.coin_preview");
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="plan-coin-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] p-6 text-[var(--color-main)] shadow-lg backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id="plan-coin-title" className="text-xl font-bold">
        {t("title")}
      </h2>
      {cost !== null ? (
        <p className="mt-3 font-semibold">{t("price", { cost })}</p>
      ) : null}
      {message ? (
        <p role="alert" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
      {canConfirm && cost !== null ? (
        <>
          <p className="mt-3 text-sm text-[var(--color-secondary)]">
            {t("explanation")}
          </p>
          <p className="mt-3 text-sm text-[var(--color-secondary)]">
            {t("continues")}
          </p>
          <Button fullWidth className="mt-5" onClick={onConfirm}>
            {t("confirm", { cost })}
          </Button>
        </>
      ) : onPremium ? (
        <Button fullWidth className="mt-5" onClick={onPremium}>
          {t("premium")}
        </Button>
      ) : null}
      <Button fullWidth variant="ghost" className="mt-2" onClick={onClose}>
        {t("close")}
      </Button>
    </dialog>
  );
}
