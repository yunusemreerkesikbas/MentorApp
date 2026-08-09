"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ZoneJoinPolicy, ZoneMemberStatus, ZoneRole } from "@mentor/types";
import { useDialog } from "@mentor/ui";
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
      <CompactMembershipButton
        busy={busy}
        label={busy ? t("leaving") : t("leave")}
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
      />
    );
  }

  if (myStatus === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {t("join_pending")}
        </span>
        <CompactMembershipButton
          busy={busy}
          label={t("cancel_request")}
          onClick={() => void leave()}
        />
      </span>
    );
  }

  return (
    <CompactMembershipButton
      busy={busy}
      label={busy ? t("joining") : t("join")}
      onClick={async () => {
        setBusy(true);
        try {
          const { status } = await joinZone(zoneId);
          onJoined(status);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

function CompactMembershipButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={() => void onClick()}
      className="group inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-card)] p-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--color-main)_15%,transparent)] px-2.5 text-xs font-bold text-[var(--color-main)]">
        {busy ? (
          <LoaderCircle size={14} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" aria-hidden />
        ) : null}
        {label}
      </span>
    </button>
  );
}
