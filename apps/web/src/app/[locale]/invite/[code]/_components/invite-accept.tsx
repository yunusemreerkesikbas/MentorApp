"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { InvitePreviewView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { FormError } from "@/components/form";
import { LEDGE, LEDGE_FILLED, PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { notifyEconomyChanged, redeemInviteCode } from "@/lib/economy";
import { RoomNoticeCard } from "../../../(app)/study-session/_components/room-notice-card";
import { InviteDetails } from "./invite-details";

/**
 * The card for a signed-in, onboarded student. Nothing is redeemed by arriving: a redeem cannot
 * be undone, it tells the inviter who joined and may send a buddy request, and a shared link is
 * public, so it takes one deliberate click. A refusal is shown in the API's own words.
 */
export function InviteAccept({ code, preview }: { code: string; preview: InvitePreviewView }) {
  const t = useTranslations("invite_landing");
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function accept() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setPhase("busy");
    try {
      await redeemInviteCode(code);
      setPhase("done");
      // The redeem completes the invite quest inline: same signal as Ayarlar's redeem, so anything
      // showing XP/Coin refreshes (the app shell also refreshes on arriving at the panel).
      notifyEconomyChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : t("accept_failed"));
      setPhase("idle");
    } finally {
      inFlight.current = false;
    }
  }

  if (phase === "done") {
    return (
      <RoomNoticeCard puhu="happy" title={t("accepted")}>
        <Link href="/dashboard" className={`${LEDGE} ${LEDGE_FILLED} w-full`}>
          {t("go_panel")}
        </Link>
      </RoomNoticeCard>
    );
  }

  return (
    <RoomNoticeCard
      puhu="happy"
      title={t("title", { name: preview.inviterDisplayName })}
      body={t("body")}
    >
      <InviteDetails code={code} preview={preview} />
      <Button fullWidth disabled={phase === "busy"} onClick={() => void accept()} className="mt-2">
        {phase === "busy" ? t("accepting") : t("accept")}
      </Button>
      <FormError message={error} />
      {error ? (
        <Link href="/dashboard" className={PANEL_QUIET_LINK}>
          {t("go_panel")}
        </Link>
      ) : null}
    </RoomNoticeCard>
  );
}
