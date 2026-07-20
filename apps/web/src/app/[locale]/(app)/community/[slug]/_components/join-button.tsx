"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ZoneJoinPolicy, ZoneMemberStatus, ZoneRole } from "@mentor/types";
import { Button, useDialog } from "@mentor/ui";
import { joinZone, leaveZone } from "@/lib/forum";

/**
 * Join/leave toggle in the zone header. States:
 * - non-member → "Katıl";
 * - PENDING → waiting note + withdraw-request button (no confirm — low stakes);
 * - ACTIVE member/mod → "Ayrıl" (confirm only for REQUEST zones: re-joining needs re-approval);
 * - OWNER → nothing (owner cannot leave; transfer = backlog).
 */
export function JoinButton({
  zoneId,
  myStatus,
  myRole,
  joinPolicy,
  onJoined,
  onLeft,
}: {
  zoneId: string;
  myStatus: ZoneMemberStatus | null;
  myRole: ZoneRole | null;
  joinPolicy: ZoneJoinPolicy;
  onJoined: (status: ZoneMemberStatus) => void;
  onLeft: () => void;
}) {
  const t = useTranslations("community");
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);

  const leave = async () => {
    setBusy(true);
    try {
      await leaveZone(zoneId);
      onLeft();
    } finally {
      setBusy(false);
    }
  };

  if (myStatus === "ACTIVE") {
    if (myRole === "OWNER") return null;
    return (
      <Button
        variant="secondary"
        busy={busy}
        onClick={async () => {
          if (joinPolicy === "REQUEST") {
            const ok = await dialog.confirm({
              title: t("leave_confirm_title"),
              message: t("leave_confirm_message"),
              confirmLabel: t("leave_confirm_yes"),
              cancelLabel: t("report_cancel"),
              closeLabel: t("attach_close"),
            });
            if (!ok) return;
          }
          await leave();
        }}
      >
        {busy ? t("leaving") : t("leave")}
      </Button>
    );
  }

  if (myStatus === "PENDING") {
    return (
      <span className="inline-flex items-center gap-3">
        <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("join_pending")}
        </span>
        <Button variant="secondary" busy={busy} onClick={() => void leave()}>
          {t("cancel_request")}
        </Button>
      </span>
    );
  }

  return (
    <Button
      variant="secondary"
      busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { status } = await joinZone(zoneId);
          onJoined(status);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? t("joining") : t("join")}
    </Button>
  );
}
