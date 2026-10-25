"use client";

import { useLocale, useTranslations } from "next-intl";
import type { InvitePreviewView } from "@mentor/types";
import { formatPromotionMagnitude } from "@/lib/promotions";

/**
 * What the invite carries, in the order a friend needs it: the discount (only when the preview
 * returned one, so checkout will honour it), the code as readable text, and the disclosure that
 * must be on screen before anything is redeemed.
 *
 * The code is text on purpose: a link opened in an in-app browser may never reach the account
 * the person finishes in, and then it can be typed into Ayarlar.
 */
export function InviteDetails({
  code,
  preview,
}: {
  code: string;
  preview: InvitePreviewView;
}) {
  const t = useTranslations("invite_landing");
  const economy = useTranslations("economy");
  const paywall = useTranslations("paywall");
  const locale = useLocale();

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {preview.discount ? (
        <p className="rounded-[var(--radius-card)] bg-[var(--color-surface-container)] px-4 py-2.5 text-body-sm font-extrabold text-[var(--play-selected-ink)]">
          {t("discount", {
            discount: formatPromotionMagnitude(preview.discount, locale, (value) =>
              paywall("discount_percent", { value }),
            ),
          })}
        </p>
      ) : null}
      <p className="flex flex-col items-center gap-1.5">
        <span className="text-caption font-bold text-[var(--color-secondary)]">{t("code_label")}</span>
        <span className="rounded-full bg-[var(--color-surface-container)] px-3 py-1.5 font-mono text-caption font-bold tracking-[0.06em] text-[var(--color-main)]">
          {code}
        </span>
      </p>
      <p className="text-pretty text-caption font-semibold text-[var(--color-secondary)]">
        {economy("redeem_disclosure_named", { name: preview.inviterDisplayName })}
      </p>
    </div>
  );
}
