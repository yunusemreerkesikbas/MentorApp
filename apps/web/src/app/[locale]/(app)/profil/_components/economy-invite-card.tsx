"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { redeemInviteSchema } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, SectionHeading } from "@mentor/ui";
import { FormError } from "@/components/form";
import { redeemInviteCode } from "@/lib/economy";

interface EconomyInviteCardProps {
  code: string;
  onRedeemed: () => void;
}

/**
 * Share invite code + redeem someone else's code. Rewards are granted server-side on conversion.
 */
export function EconomyInviteCard({
  code,
  onRedeemed,
}: EconomyInviteCardProps) {
  const translate = useTranslations("economy");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  async function handleCopy() {
    setCopyHint(null);
    try {
      await navigator.clipboard.writeText(code);
      setCopyHint(translate("copied"));
    } catch {
      setCopyHint(translate("copy_failed"));
    }
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setRedeemError(null);
    setRedeemSuccess(null);
    const parsed = redeemInviteSchema.safeParse({ code: input });
    if (!parsed.success) {
      setRedeemError(translate("redeem_invalid"));
      return;
    }
    setBusy(true);
    try {
      const result = await redeemInviteCode(parsed.data.code);
      setInput("");
      setRedeemSuccess(
        result.status === "PENDING"
          ? translate("redeem_pending")
          : translate("redeem_saved"),
      );
      onRedeemed();
    } catch (err) {
      setRedeemError(
        err instanceof ApiClientError
          ? err.body.message
          : translate("redeem_failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionHeading subtitle={translate("invite_subtitle")}>
        {translate("invite_title")}
      </SectionHeading>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code
          className="min-w-0 flex-1 overflow-hidden text-ellipsis rounded-[var(--radius-card)] px-3 py-2 text-base font-medium tabular-nums"
          style={{
            color: "var(--color-main)",
            backgroundColor: "var(--color-surface-muted, rgba(0,0,0,0.03))",
          }}
        >
          {code}
        </code>
        <Button
          type="button"
          onClick={() => void handleCopy()}
          className="shrink-0"
        >
          {translate("copy")}
        </Button>
      </div>
      {copyHint ? (
        <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
          {copyHint}
        </p>
      ) : null}

      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => void handleRedeem(e)}
      >
        <label
          className="text-sm font-medium"
          style={{ color: "var(--color-main)" }}
        >
          {translate("have_code")}
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
          {busy ? translate("redeeming") : translate("use_code")}
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
