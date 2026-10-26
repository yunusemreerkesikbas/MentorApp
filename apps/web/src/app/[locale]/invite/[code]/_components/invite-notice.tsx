"use client";

import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { LEDGE, LEDGE_FILLED, PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { RoomNoticeCard } from "../../../(app)/study-session/_components/room-notice-card";

/** Where the one way out of a notice leads, and what it is called. */
export type InviteNoticeExit = {
  href: "/signup" | "/onboarding" | "/dashboard" | "/students";
  label: "invalid_cta" | "go_panel";
};

/**
 * The calm card for a link that cannot be used: a dead or malformed code, a coach (who is outside
 * the invite economy), or a lookup that failed. No code is kept and nothing can be redeemed here.
 * A failed lookup is not the link's fault, so it says so and offers a retry before the exit.
 */
export function InviteNotice({
  kind,
  exit,
  onRetry,
}: {
  kind: "invalid" | "failed";
  exit: InviteNoticeExit;
  onRetry: () => void;
}) {
  const t = useTranslations("invite_landing");

  return (
    <RoomNoticeCard
      puhu="encouraging"
      title={t(kind === "failed" ? "failed_title" : "invalid_title")}
      body={t(kind === "failed" ? "failed_body" : "invalid_body")}
    >
      {kind === "failed" ? (
        <Button fullWidth onClick={onRetry}>
          {t("retry")}
        </Button>
      ) : null}
      <Link
        href={exit.href}
        className={kind === "failed" ? PANEL_QUIET_LINK : `${LEDGE} ${LEDGE_FILLED} w-full`}
      >
        {t(exit.label)}
      </Link>
    </RoomNoticeCard>
  );
}
