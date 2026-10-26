"use client";

import { useTranslations } from "next-intl";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { RoomNoticeCard } from "../../../(app)/study-session/_components/room-notice-card";

/**
 * The card for a signed-in student this invite cannot do anything for: they already came with a
 * friend's invite (`redeemedBy`, that friend's name), or can no longer use one (paid already, or
 * past the signup window). Nothing to accept and no discount line, since checkout would not give
 * one; just the way back to the panel.
 */
export function InviteStanding({ redeemedBy }: { redeemedBy: string | null }) {
  const t = useTranslations("invite_landing");
  const economy = useTranslations("economy");
  // A blank name (the inviter's row is gone) would print "davetiyle geldin!" with nobody in it.
  const name = redeemedBy?.trim() ?? "";

  return (
    <RoomNoticeCard
      puhu={name ? "happy" : "encouraging"}
      title={name ? economy("redeemed_state", { name }) : t("closed_title")}
      body={name ? undefined : t("closed_body")}
    >
      <Link href="/dashboard" className={`${LEDGE} ${LEDGE_FILLED} w-full`}>
        {t("go_panel")}
      </Link>
    </RoomNoticeCard>
  );
}
