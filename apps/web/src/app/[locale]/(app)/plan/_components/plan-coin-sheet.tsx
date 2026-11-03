"use client";

import type { PlanPreviewAccessDto } from "@mentor/types";
import { Clock3 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Modal } from "@mentor/ui";
import { PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import {
  UNLOCK_GLYPH, UnlockCaption, UnlockChoice, UnlockRow, type UnlockCoin, type UnlockConfirm,
} from "@/components/unlock-choice";
import { useSubscription } from "@/lib/subscription-context";
import { clockSuffix, planAccessView } from "./plan-coin-view";
import type { PlanCoinSheetState } from "./use-plan-coin-flow";

/** "Koçla planla" on the Coin path: Coin or Premium first, the wizard after (DESIGN.md §6.1 Açma seçimi). */
export function PlanCoinSheet({ offer, sheet, purchases, busy, onArm, onConfirm, onCancel, onPremium, onRetry, onSaved, onClose }: {
  offer: PlanPreviewAccessDto; sheet: PlanCoinSheetState; purchases: boolean; busy: boolean;
  onArm: () => void; onConfirm: () => void; onCancel: () => void; onPremium: () => void;
  onRetry: () => void; onSaved: () => void; onClose: () => void;
}) {
  const t = useTranslations("plan.coin_preview");
  const format = useFormatter();
  const trial = useSubscription().view?.trialEligibility;
  const view = planAccessView(offer, purchases);
  const { coinConfirmed: balance, dailyLimit: limit, dailyRemaining: remaining } = offer;
  const resume = sheet.resume;
  const cost = resume?.cost ?? offer.cost ?? 0;

  const next = offer.nextAvailableAt ? new Date(offer.nextAvailableAt) : null;
  const time = next ? format.dateTime(next, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "";
  const today = next && format.dateTime(next, { dateStyle: "short" }) === format.dateTime(new Date(), { dateStyle: "short" });
  const coin: UnlockCoin | null = view.kind !== "choice" ? null : {
    title: view.coin === "limit" ? t("limit_title", { limit }) : t("coin_title", { cost }),
    count: view.coin === "ready" ? t("balance", { balance }) : view.coin === "short" ? `${balance}/${cost}` : undefined,
    progress: view.coin === "short" ? { value: balance, max: cost, label: t("coin_progress") } : undefined,
    pips: view.coin === "short" ? undefined
      : { limit, remaining, label: t("allowance_label", { limit, remaining }), text: t("allowance", { limit }) },
    caption: view.coin === "ready" ? t("coin_ready") : view.coin === "short" ? t("coin_short", { missing: view.missing })
      : next ? t("next_available", { day: today ? "today" : "tomorrow", time, suffix: clockSuffix(time) }) : undefined,
    cta: t("coin", { cost }),
    howTo: view.coin === "short" ? { href: { pathname: "/profile", hash: "coin" }, label: t("coin_how") } : undefined,
    onArm,
  };
  const confirm: UnlockConfirm | null = resume || (sheet.armed && view.kind === "choice" && view.coin === "ready") ? {
    title: resume ? t("resume_title") : t("coin_title", { cost }), lead: t("confirm_lead"), from: String(balance),
    to: t("coin_amount", { amount: balance - cost }), note: t(resume ? "resume_note" : "confirm_note"),
    confirm: t(resume ? "resume_confirm" : "confirm"), cancel: t("cancel"), onConfirm, onCancel,
  } : null;
  const premiumCta = trial && (trial.eligible || trial.reason === "PHONE_REQUIRED") ? t("trial") : t("premium");

  return (
    <Modal placement="sheet" title={t("title")} closeLabel={t("close")} closeDisabled={busy} onClose={onClose}>
      {sheet.error ? <p role="alert" className="text-caption font-semibold text-[var(--color-danger)]">{sheet.error}</p> : null}
      {confirm || view.kind === "choice" ? (
        // Alone in the sheet the confirm block drops its hairline: the header already draws one.
        <div className={confirm ? "[&>div:first-child]:border-t-0 [&>div:first-child]:pt-0" : undefined}>
          <UnlockChoice heading={t("choose")} lead={view.kind === "choice" ? view.lead : null} busy={busy} coin={coin} confirm={confirm}
            premium={view.kind === "choice" && view.premium ? { title: t("premium_title"), caption: t("premium_detail"),
              cta: view.lead === "premium" ? premiumCta : t("premium"), onSelect: onPremium } : null} />
          {confirm ? null : <p className="mt-1 text-center text-caption font-semibold text-[var(--color-secondary)]">{t("saved_detail")}</p>}
        </div>
      ) : view.kind === "retry" ? (
        <div role="status">
          <UnlockRow flush title={t("unavailable_title")} icon={<Clock3 className={`${UNLOCK_GLYPH} text-[var(--color-secondary)]`} strokeWidth={1.9} aria-hidden />}>
            <UnlockCaption>{t("unavailable_detail")}</UnlockCaption>
            <Button variant="secondary" fullWidth busy={busy} onClick={onRetry}>{t("retry")}</Button>
          </UnlockRow>
        </div>
      ) : view.kind === "notice" ? (
        <p role="status" className="text-body-sm font-semibold text-[var(--color-secondary)]">{view.message}</p>
      ) : null}
      {offer.latestRequestId && !confirm ? (
        <button type="button" className={`${PANEL_TEXT_LINK} cursor-pointer self-center`} disabled={busy} onClick={onSaved}>{t("saved")}</button>
      ) : null}
    </Modal>
  );
}
