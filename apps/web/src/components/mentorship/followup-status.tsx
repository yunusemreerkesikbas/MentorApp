"use client";

import type {
  MentorshipFollowupResponse,
  MentorshipFollowupStatus,
} from "@mentor/types";
import { useTranslations } from "next-intl";

export function FollowupStatus({
  status,
  response,
  shared = false,
}: {
  status: MentorshipFollowupStatus;
  response: MentorshipFollowupResponse;
  shared?: boolean;
}) {
  const t = useTranslations("mentorship");
  return (
    <div className="flex flex-wrap gap-2">
      <span
        className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-container)] px-3 py-1 text-xs font-semibold"
        style={{ color: "var(--color-main)" }}
      >
        {t(`followup_status_${status}`)}
      </span>
      {shared ? (
        <span
          className="rounded-full border px-3 py-1 text-xs font-semibold"
          style={{
            borderColor:
              response === "ACCEPTED" ? "var(--color-success)" : "var(--color-accent)",
            color:
              response === "ACCEPTED" ? "var(--color-success)" : "var(--color-main)",
          }}
        >
          {t(`followup_response_${response}`)}
        </span>
      ) : null}
    </div>
  );
}
