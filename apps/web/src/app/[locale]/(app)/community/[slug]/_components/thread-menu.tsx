"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ModerationTargetType, ReportReason } from "@mentor/types";
import { createReport } from "@/lib/forum";

const REASONS: { value: ReportReason; key: string }[] = [
  { value: ReportReason.SPAM, key: "report_spam" },
  { value: ReportReason.HARASSMENT, key: "report_harassment" },
  { value: ReportReason.OFF_TOPIC, key: "report_off_topic" },
  { value: ReportReason.OTHER, key: "report_other" },
];

/**
 * Threads-style "⋯" overflow menu (Figma 1:288 dots). Consolidates a target's actions — report
 * (always) + pin/delete (moderators) — into one compact dropdown instead of inline text. Reused for
 * both feed threads (targetType THREAD) and comments (targetType POST) so headers stay narrow.
 */
export function ThreadMenu({
  targetId,
  targetType = ModerationTargetType.THREAD,
  isPinned = false,
  canModerate,
  onPin,
  onDelete,
}: {
  targetId: string;
  targetType?: ModerationTargetType;
  isPinned?: boolean;
  canModerate?: boolean;
  onPin?: (pinned: boolean) => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("community");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "report" | "done">("menu");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setView("menu");
  };

  const submitReport = async (reason: ReportReason) => {
    setBusy(true);
    try {
      await createReport(targetType, targetId, reason);
    } catch {
      // idempotent server-side — re-report is a no-op
    } finally {
      setBusy(false);
      setView("done");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t("report")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setView("menu");
        }}
        className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-secondary)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-xl bg-white py-1"
            style={{ border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0px 8px 24px rgba(37,73,150,0.12)" }}
          >
            {view === "menu" && (
              <>
                {canModerate && (
                  <MenuItem
                    onClick={() => {
                      onPin?.(!isPinned);
                      close();
                    }}
                  >
                    {isPinned ? t("unpin") : t("pin")}
                  </MenuItem>
                )}
                <MenuItem onClick={() => setView("report")}>{t("report")}</MenuItem>
                {canModerate && (
                  <MenuItem
                    danger
                    onClick={() => {
                      onDelete?.();
                      close();
                    }}
                  >
                    {t("delete")}
                  </MenuItem>
                )}
              </>
            )}

            {view === "report" && (
              <>
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-secondary)" }}>
                  {t("report_reason")}
                </p>
                {REASONS.map((r) => (
                  <MenuItem key={r.value} disabled={busy} onClick={() => void submitReport(r.value)}>
                    {t(r.key as `report_${string}`)}
                  </MenuItem>
                ))}
              </>
            )}

            {view === "done" && (
              <p className="px-3 py-2.5 text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("report_done")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:bg-black/[0.04] disabled:opacity-50"
      style={{ color: danger ? "var(--color-danger)" : "var(--color-main)" }}
    >
      {children}
    </button>
  );
}
