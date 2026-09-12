"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, ShieldCheck } from "lucide-react";
import type { MentorshipDataScopeKey } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card } from "@mentor/ui";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchOverview } from "@/lib/mentorship";
import { CoachScopeModal } from "./coach-scope-modal";

/**
 * The coach's copy of the data-scope contract, on the settings screen (APP-0xx redesign).
 *
 * Rendered only for a coach: `dataScope` comes from `GET /v1/mentorship/overview`, which is
 * `@Roles(COACH)`, so for anybody else this row would be a door onto a 403.
 *
 * The scope is fetched when the row is pressed, not on mount. Settings is a page a student opens
 * far more often than a coach, and a contract nobody asked to read should not cost a request on
 * every visit.
 */
export function CoachScopeCard() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const [scope, setScope] = useState<readonly MentorshipDataScopeKey[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function openModal() {
    // Already read once this visit: the contract does not change between two presses.
    if (scope !== null) {
      setOpen(true);
      return;
    }
    setBusy(true);
    try {
      const overview = await fetchOverview();
      setScope(overview.dataScope);
      setOpen(true);
    } catch (err) {
      toast.error({
        title: common("error_title"),
        // The API localizes its own messages, including the `mentorship.enabled` refusal.
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="p-0">
        <button
          type="button"
          disabled={busy}
          onClick={openModal}
          aria-haspopup="dialog"
          className="flex min-h-14 w-full cursor-pointer items-center gap-3.5 rounded-[var(--radius-card)] px-5 py-3 text-left outline-none transition-colors hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            className="grid size-10 flex-none place-items-center rounded-[var(--radius-card)]"
            style={{
              backgroundColor: "var(--color-surface-container)",
              color: "var(--color-secondary)",
            }}
          >
            <ShieldCheck aria-hidden size={20} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block text-[15px] font-semibold"
              style={{ color: "var(--color-main)" }}
            >
              {t("coach_scope_title")}
            </span>
            <span className="mt-0.5 block text-xs" style={{ color: "var(--color-secondary)" }}>
              {t("coach_scope_row_body")}
            </span>
          </span>
          <ChevronRight
            aria-hidden
            size={18}
            strokeWidth={2}
            className="flex-none"
            style={{ color: "var(--color-secondary)" }}
          />
        </button>
      </Card>
      {open && scope !== null && (
        <CoachScopeModal scope={scope} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
