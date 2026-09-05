"use client";

import { useTranslations } from "next-intl";
import type { MentorshipDataScopeKey } from "@mentor/types";
import { Card } from "@mentor/ui";

/**
 * The consent contract from the coach's side.
 *
 * The student reads the same list before accepting; until now the coach read nothing at all, which
 * left the one asymmetry the trust line cannot afford — the person receiving the data knowing less
 * about its limits than the person handing it over.
 *
 * `scope` comes from the API for the same reason the student's screen takes it from the API: the
 * two screens describe one contract, and a second copy in the client is a second thing to drift.
 *
 * Native `<details>` rather than a state hook: it is a disclosure, and the platform has one. Open
 * by default only while the roster is empty, which is the coach's first screen.
 */
export function CoachScopeCard({
  scope,
  defaultOpen,
}: {
  scope: readonly MentorshipDataScopeKey[];
  defaultOpen: boolean;
}) {
  const t = useTranslations("mentorship");
  return (
    <Card>
      <details open={defaultOpen}>
        <summary
          className="cursor-pointer text-sm font-semibold marker:text-[var(--color-secondary)]"
          style={{ color: "var(--color-main)" }}
        >
          {t("coach_scope_title")}
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <ul
            className="flex list-disc flex-col gap-1 pl-5 text-sm"
            style={{ color: "var(--color-secondary)" }}
          >
            {scope.map((key) => (
              <li key={key}>{t(`coach_scope_${key}`)}</li>
            ))}
          </ul>
          {/* What the coach WRITES, not reads — beside the list, not inside it. */}
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("coach_scope_writes")}
          </p>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
              {t("coach_scope_never_title")}
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("coach_scope_never_body")}
            </p>
          </div>
        </div>
      </details>
    </Card>
  );
}
