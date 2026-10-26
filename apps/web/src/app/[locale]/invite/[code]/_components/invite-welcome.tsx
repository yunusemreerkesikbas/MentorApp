"use client";

import { useTranslations } from "next-intl";
import type { InvitePreviewView } from "@mentor/types";
import { LEDGE, LEDGE_FILLED, PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { rememberPendingReferral } from "@/lib/pending-referral";
import { RoomNoticeCard } from "../../../(app)/study-session/_components/room-notice-card";
import { InviteDetails } from "./invite-details";

/**
 * The card for someone who is not in the app yet, or is in it but has not finished onboarding.
 *
 * The code is remembered when the visitor chooses a button, not when the page is viewed: looking
 * at a link is not the same as agreeing to be connected. It is redeemed when onboarding ends.
 * Both buttons go to the ordinary routes, so the pilot signup gate keeps applying.
 */
export function InviteWelcome({
  code,
  preview,
  signedIn,
}: {
  code: string;
  preview: InvitePreviewView;
  /** Signed in but still in onboarding: the way on is the wizard, there is no account to find. */
  signedIn: boolean;
}) {
  const t = useTranslations("invite_landing");
  const remember = () => rememberPendingReferral(code);

  return (
    <RoomNoticeCard
      puhu="happy"
      title={t("title", { name: preview.inviterDisplayName })}
      body={t("body")}
    >
      <InviteDetails code={code} preview={preview} />
      <Link
        href={signedIn ? "/onboarding" : "/signup"}
        onClick={remember}
        className={`${LEDGE} ${LEDGE_FILLED} mt-2 w-full`}
      >
        {t("start")}
      </Link>
      {signedIn ? null : (
        <Link
          href={{ pathname: "/login", query: { next: `/invite/${code}` } }}
          onClick={remember}
          className={PANEL_QUIET_LINK}
        >
          {t("login")}
        </Link>
      )}
    </RoomNoticeCard>
  );
}
