"use client";

import { useState } from "react";
import { redeemInviteSchema } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, SectionHeading } from "@mentor/ui";
import { FormError } from "../../../../components/form";
import { redeemInviteCode } from "../../../../lib/economy";

interface EconomyInviteCardProps {
  code: string;
  onRedeemed: () => void;
}

/**
 * Share invite code + redeem someone else's code. Rewards are granted server-side on conversion.
 */
export function EconomyInviteCard({ code, onRedeemed }: EconomyInviteCardProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  async function handleCopy() {
    setCopyHint(null);
    try {
      await navigator.clipboard.writeText(code);
      setCopyHint("Kopyalandı");
    } catch {
      setCopyHint("Kopyalanamadı");
    }
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setRedeemError(null);
    setRedeemSuccess(null);
    const parsed = redeemInviteSchema.safeParse({ code: input });
    if (!parsed.success) {
      setRedeemError("Geçerli bir davet kodu gir.");
      return;
    }
    setBusy(true);
    try {
      const result = await redeemInviteCode(parsed.data.code);
      setInput("");
      setRedeemSuccess(
        result.status === "PENDING"
          ? "Davet kodun kaydedildi. Ödül, koşullar sağlandığında hesabına yansır."
          : "Davet kodun kaydedildi.",
      );
      onRedeemed();
    } catch (err) {
      setRedeemError(err instanceof ApiClientError ? err.body.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionHeading subtitle="Arkadaşın kayıt olup aktif olunca ikiniz de kazanırsınız.">
        Davet et
      </SectionHeading>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code
          className="flex-1 rounded-[var(--radius-card)] px-3 py-2 text-base font-medium tabular-nums"
          style={{
            color: "var(--color-main)",
            backgroundColor: "var(--color-surface-muted, rgba(0,0,0,0.03))",
          }}
        >
          {code}
        </code>
        <Button type="button" onClick={() => void handleCopy()} className="shrink-0">
          Kodu kopyala
        </Button>
      </div>
      {copyHint ? (
        <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
          {copyHint}
        </p>
      ) : null}

      <form className="mt-6 flex flex-col gap-3" onSubmit={(e) => void handleRedeem(e)}>
        <label className="text-sm font-medium" style={{ color: "var(--color-main)" }}>
          Bir davet kodun var mı?
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="MENTOR-…"
          autoComplete="off"
          className="min-h-[44px] w-full rounded-[var(--radius-card)] border px-3 text-base"
          style={{
            borderColor: "var(--color-border, #ccc)",
            color: "var(--color-main)",
            backgroundColor: "var(--color-surface, #fff)",
          }}
          disabled={busy}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Kaydediliyor…" : "Kodu kullan"}
        </Button>
        {redeemError ? <FormError message={redeemError} /> : null}
        {redeemSuccess ? (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {redeemSuccess}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
