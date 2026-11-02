"use client";

import type { ComponentProps, ReactNode } from "react";
import { ArrowRight, ChevronRight, Coins } from "lucide-react";
import { Button } from "@mentor/ui";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { ProgressLine } from "@/components/panel/progress-line";
import { PANEL_QUIET_LINK, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";

/**
 * "Açma seçimi" (DESIGN.md §6.1): how a free user opens a Coin sink, with Coin or Premium.
 * Hairline rows, never nested cards; exactly one ledge, under the row that leads.
 * Pilot: the weekly recap. Plan draft, notebook capacity and streak freeze adopt it next.
 */

export const UNLOCK_GLYPH = "size-[22px] shrink-0";

export function UnlockRow({ icon, title, aside, children, as: Title = "h3", flush = false }: {
  icon?: ReactNode; title: string; aside?: ReactNode; children?: ReactNode; as?: "h2" | "h3";
  /** The card's only row: no hairline above it. */
  flush?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2.5 ${flush ? "pb-1" : "border-t border-[var(--play-line)] py-4"}`}>
      <div className="flex items-center gap-2.5">
        {icon}
        <Title className="min-w-0 flex-1 text-body-sm font-extrabold text-[var(--color-main)]">{title}</Title>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function UnlockCaption({ children }: { children: ReactNode }) {
  return <p className="text-caption font-semibold text-[var(--color-secondary)]">{children}</p>;
}

export interface UnlockPremium { title: string; caption: string; cta: string; onSelect: () => void }
export interface UnlockCoin {
  title: string;
  /** Title-line count: "80/250" when short, "Bakiyen 320" when ready. */
  count?: string;
  progress?: { value: number; max: number; label: string };
  /** Rolling allowance: filled pips are uses still available. */
  pips?: { limit: number; remaining: number; label: string; text: string };
  caption?: string;
  cta: string;
  howTo?: { href: ComponentProps<typeof Link>["href"]; label: string };
  onArm: () => void;
}
export interface UnlockConfirm {
  title: string; lead: string; from: string; to: string; note: string;
  confirm: string; cancel: string; onConfirm: () => void; onCancel: () => void;
}

export function UnlockChoice({ heading, lead, premium, coin, confirm, busy }: {
  heading: string; lead: "coin" | "premium" | null;
  premium: UnlockPremium | null; coin: UnlockCoin | null; confirm: UnlockConfirm | null; busy: boolean;
}) {
  if (confirm) return <CoinConfirm {...confirm} busy={busy} />;
  const premiumRow = premium ? (
    <UnlockRow key="premium" title={premium.title} aside={<PremiumBadge />}>
      <UnlockCaption>{premium.caption}</UnlockCaption>
      {lead === "premium" ? <Button fullWidth disabled={busy} onClick={premium.onSelect}>{premium.cta}</Button>
        : <button type="button" className={`${PANEL_TEXT_LINK} cursor-pointer self-start`} onClick={premium.onSelect}>
          {premium.cta}<ChevronRight size={16} strokeWidth={2.25} aria-hidden />
        </button>}
    </UnlockRow>
  ) : null;
  const coinRow = coin ? (
    <UnlockRow key="coin" title={coin.title}
      icon={<Coins className={`${UNLOCK_GLYPH} text-[var(--play-cta)]`} strokeWidth={1.9} aria-hidden />}
      aside={coin.count ? <span className="text-caption font-extrabold tabular-nums text-[var(--color-secondary)]">{coin.count}</span> : null}>
      {coin.progress ? <ProgressLine appearance="play" {...coin.progress} /> : null}
      {coin.pips ? <Pips {...coin.pips} /> : null}
      {coin.caption ? <UnlockCaption>{coin.caption}</UnlockCaption> : null}
      {lead === "coin" ? <Button fullWidth busy={busy} onClick={coin.onArm}>{coin.cta}</Button> : null}
      {coin.howTo ? <Link href={coin.howTo.href} className={`${PANEL_TEXT_LINK} self-start`}>
        {coin.howTo.label}<ChevronRight size={16} strokeWidth={2.25} aria-hidden />
      </Link> : null}
    </UnlockRow>
  ) : null;
  return (
    <>
      <h2 className="mb-3 text-base font-extrabold text-[var(--color-main)]">{heading}</h2>
      {lead === "coin" ? [coinRow, premiumRow] : [premiumRow, coinRow]}
    </>
  );
}

function Pips({ limit, remaining, label, text }: NonNullable<UnlockCoin["pips"]>) {
  return (
    <div role="img" aria-label={label} className="flex items-center gap-1.5 text-caption font-bold text-[var(--color-main)]">
      {Array.from({ length: limit }, (_, i) => (
        <span key={i} aria-hidden className={`size-3 rounded-full ${i < remaining
          ? "bg-[var(--play-cta)] shadow-[inset_0_2px_0_var(--play-cta-shine)]"
          : "border-[1.5px] border-dashed border-[var(--color-secondary)] bg-[var(--play-track)] opacity-60"}`} />
      ))}
      <span aria-hidden className="ml-0.5">{text}</span>
    </div>
  );
}

/** Inline confirmation: the balance before and after, then one ledge. No dialog, no relabelled button. */
function CoinConfirm({ title, lead, from, to, note, confirm, cancel, onConfirm, onCancel, busy }: UnlockConfirm & { busy: boolean }) {
  return (
    <div className="border-t border-[var(--play-line)] pt-4">
      <div className="flex items-center gap-2.5">
        <Coins className={`${UNLOCK_GLYPH} text-[var(--play-cta)]`} strokeWidth={1.9} aria-hidden />
        <h2 className="min-w-0 flex-1 text-body-sm font-extrabold text-[var(--color-main)]">{title}</h2>
      </div>
      <div role="group" aria-label={title} className="mt-3 rounded-[var(--play-radius)] bg-[var(--play-selected)] p-4">
        <p className="text-caption font-extrabold text-[var(--play-selected-ink)]">{lead}</p>
        <p className="mt-1 flex items-baseline gap-2.5 tabular-nums">
          <span className="text-lg font-extrabold text-[var(--color-secondary)]">{from}</span>
          <ArrowRight size={18} strokeWidth={2.25} className="self-center text-[var(--play-selected-ink)]" aria-hidden />
          <span className="text-display font-black text-[var(--color-main)]">{to}</span>
        </p>
        <p className="mt-2 text-caption font-semibold text-[var(--color-main)]">{note}</p>
        <div className="mt-3.5 flex flex-col items-center gap-1">
          <Button fullWidth busy={busy} onClick={onConfirm}>{confirm}</Button>
          <button type="button" className={PANEL_QUIET_LINK} disabled={busy} onClick={onCancel}>{cancel}</button>
        </div>
      </div>
    </div>
  );
}
