"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ZoneJoinPolicy, ZoneMemberStatus, ZoneRole } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { joinZone, leaveZone } from "@/lib/forum";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { ZONES_CHANGED_EVENT } from "../../_components/zone-sidebar";

/**
 * A room membership's actions. Joining is the visitor's one ledge (the composer is the member's);
 * leaving and withdrawing a request live in the room menu. Confirm only for REQUEST rooms, where
 * coming back needs approval again. The owner cannot leave (transfer is backlog).
 */
export function useZoneMembership({
  zoneId,
  myRole,
  joinPolicy,
  onJoined,
  onLeft,
}: {
  zoneId: string;
  myRole: ZoneRole | null;
  joinPolicy: ZoneJoinPolicy;
  onJoined: (status: ZoneMemberStatus) => void;
  onLeft: () => void;
}) {
  const t = useTranslations("community");
  const dialog = useMentorDialog();
  const toast = useMentorToast();
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      window.dispatchEvent(new Event(ZONES_CHANGED_EVENT));
    } catch (error) {
      // Callers fire and forget, so a failure is said here rather than left unhandled.
      toast.error({ title: error instanceof ApiClientError ? error.body.message : t("error") });
    } finally {
      setBusy(false);
    }
  };

  const join = () =>
    run(async () => {
      const { status } = await joinZone(zoneId);
      onJoined(status);
    });

  const leave = async (confirm: boolean) => {
    if (confirm && joinPolicy === "REQUEST") {
      const ok = await dialog.confirm({
        title: t("leave_confirm_title"),
        message: t("leave_confirm_message"),
        confirmLabel: t("leave_confirm_yes"),
        cancelLabel: t("report_cancel"),
        destructive: true,
      });
      if (!ok) return;
    }
    await run(async () => {
      await leaveZone(zoneId);
      onLeft();
    });
  };

  return { busy, join, leave, canLeave: myRole !== "OWNER" };
}

/** The visitor's ledge in the room header, with one line on what joining gives. */
export function ZoneJoinLedge({ busy, onJoin }: { busy: boolean; onJoin: () => void }) {
  const t = useTranslations("community");
  return (
    <div className="flex flex-col items-start gap-2">
      <Button busy={busy} onClick={onJoin} className="w-full sm:w-auto">
        {busy ? t("joining") : t("zone_join_ledge")}
      </Button>
      <p className="text-caption font-semibold text-[var(--color-secondary)]">{t("zone_join_hint")}</p>
    </div>
  );
}
