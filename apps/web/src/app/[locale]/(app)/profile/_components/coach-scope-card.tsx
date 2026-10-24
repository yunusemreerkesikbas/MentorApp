"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipDataScopeKey } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card } from "@mentor/ui";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchOverview } from "@/lib/mentorship";
import { ListRow } from "./account-links-card";
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
  const { error: toastError } = useMentorToast();
  const [scope, setScope] = useState<readonly MentorshipDataScopeKey[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function openModal() {
    if (busy) return;
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
      toastError({
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
      <Card solid className="p-2 sm:p-2.5" aria-busy={busy}>
        <div className="px-2 pt-1 pb-1.5">
          <h2
            className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("coach_scope_section")}
          </h2>
        </div>
        <ListRow description={t("coach_scope_row_body")} onClick={() => void openModal()}>
          {t("coach_scope_title")}
        </ListRow>
      </Card>
      {open && scope !== null && (
        <CoachScopeModal scope={scope} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
