"use client";

import { useTranslations } from "next-intl";
import { Check, EyeOff } from "lucide-react";
import type { MentorshipDataScopeKey } from "@mentor/types";
import { Modal } from "@mentor/ui";

/**
 * The consent contract from the coach's side.
 *
 * The student reads this same list before accepting; until APP-073 the coach read nothing at all,
 * which left the one asymmetry the trust line cannot afford — the person receiving the data
 * knowing less about its limits than the person handing it over.
 *
 * It lives behind a settings row rather than on the roster, where it used to be a permanent
 * accordion. A consent document is read once when the coach starts and re-read when they wonder;
 * beside a list opened every morning it was furniture.
 *
 * `scope` comes from the API for the same reason the student's screen takes it from the API: the
 * two screens describe one contract, and a second copy in the client is a second thing to drift.
 */
export function CoachScopeModal({
  scope,
  onClose,
}: {
  scope: readonly MentorshipDataScopeKey[];
  onClose: () => void;
}) {
  const t = useTranslations("mentorship");
  // The shared dialog close label, not a key of this screen's own.
  const dialogCopy = useTranslations("common.dialog");

  return (
    <Modal title={t("coach_scope_title")} closeLabel={dialogCopy("close")} onClose={onClose}>
      <p className="-mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
        {t("coach_scope_subtitle")}
      </p>

      {/* A neutral tick per line rather than a green badge: it marks membership of the list, not
          approval of the student. */}
      <ul className="flex list-none flex-col gap-2.5 p-0">
        {scope.map((key) => (
          <li key={key} className="flex items-start gap-2.5">
            <Check
              aria-hidden
              size={16}
              strokeWidth={2.5}
              className="mt-[3px] flex-none"
              style={{ color: "var(--color-success)" }}
            />
            <span className="text-sm leading-relaxed" style={{ color: "var(--color-body)" }}>
              {t(`coach_scope_${key}`)}
            </span>
          </li>
        ))}
      </ul>

      {/* What the coach WRITES, not reads — beside the list, not inside it. */}
      <div
        className="rounded-[var(--radius-card)] p-4"
        style={{ backgroundColor: "var(--color-surface-container)" }}
      >
        <p className="text-[13px] font-bold" style={{ color: "var(--color-main)" }}>
          {t("coach_scope_writes_title")}
        </p>
        <p
          className="mt-1.5 text-pretty text-sm leading-relaxed"
          style={{ color: "var(--color-body)" }}
        >
          {t("coach_scope_writes")}
        </p>
      </div>

      {/* The trust line (AGENTS §4 #5): the student's own words never reach here. It gets its own
          block above a rule — this is the half a coach must not skim. */}
      <div
        className="border-t pt-5"
        style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 16%, transparent)" }}
      >
        <p
          className="flex items-center gap-2 text-[13px] font-bold"
          style={{ color: "var(--color-main)" }}
        >
          <EyeOff
            aria-hidden
            size={16}
            strokeWidth={2}
            style={{ color: "var(--color-secondary)" }}
          />
          {t("coach_scope_never_title")}
        </p>
        <p
          className="mt-2 text-pretty text-sm leading-relaxed"
          style={{ color: "var(--color-body)" }}
        >
          {t("coach_scope_never_body")}
        </p>
      </div>
    </Modal>
  );
}
