"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ModerationTargetType, ReportReason } from "@mentor/types";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
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
    <PopoverMenu
      align="right"
      menuClassName="w-48"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView("menu");
      }}
      trigger={({ open: isOpen, setOpen: setMenuOpen, menuId }) => (
        <button
          type="button"
          aria-label={t("report")}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? menuId : undefined}
          onClick={() => {
            setMenuOpen(!isOpen);
            setView("menu");
          }}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          style={{ color: "var(--color-secondary)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
      )}
    >
      {view === "menu" ? (
        <>
          {canModerate ? (
            <PopoverMenuItem
              onClick={() => {
                onPin?.(!isPinned);
              }}
            >
              {isPinned ? t("unpin") : t("pin")}
            </PopoverMenuItem>
          ) : null}
          <PopoverMenuItem closeOnClick={false} onClick={() => setView("report")}>
            {t("report")}
          </PopoverMenuItem>
          {canModerate ? (
            <PopoverMenuItem danger onClick={() => onDelete?.()}>
              {t("delete")}
            </PopoverMenuItem>
          ) : null}
        </>
      ) : null}

      {view === "report" ? (
        <>
          <p
            className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("report_reason")}
          </p>
          {REASONS.map((r) => (
            <PopoverMenuItem
              key={r.value}
              disabled={busy}
              closeOnClick={false}
              onClick={() => void submitReport(r.value)}
            >
              {t(r.key as `report_${string}`)}
            </PopoverMenuItem>
          ))}
        </>
      ) : null}

      {view === "done" ? (
        <p className="px-3 py-2.5 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("report_done")}
        </p>
      ) : null}
    </PopoverMenu>
  );
}
