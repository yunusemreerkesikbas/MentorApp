"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipCohortBriefDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { RefreshCw } from "lucide-react";
import { Button, Card } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchCohortBrief, generateCohortBrief } from "@/lib/mentorship";
import { formatDate } from "../../_components/mentorship-format";
import { RiskChip } from "../../_components/risk-chip";
import { NewBadge } from "../../_components/signal-pill";

/**
 * The coach's morning read: who is waiting, across the whole roster, in one paragraph plus a line
 * each (roadmap §9's "koç panele girince kim geride, neden, ne yapmalı otomatik öne çıkar").
 *
 * It DOES fetch on mount, unlike the per-student `brief-card.tsx` — and the difference is the whole
 * design. `GET` reads what was already written and spends nothing; only the refresh button can
 * reach the model. So the brief is present on arrival without a page view ever billing a coach.
 *
 * The chips beside each sentence are the rule-based flags, not the model's opinion. That ordering
 * is deliberate: a deterministic flag the coach can trust stays the floor, and the sentence sits on
 * top of it rather than in place of it.
 */
export function CohortBriefCard() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const { error: toastError } = useMentorToast();
  const [brief, setBrief] = useState<MentorshipCohortBriefDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const showError = useCallback(
    (err: unknown) => {
      // The stable helper, not the whole toast object: `useMentorToast` memoizes on
      // `toast.toasts`, so the object's identity changes on every toast. Depending on the object
      // is what made the roster refetch itself into a 429 (mentorship.md, 2026-09-11).
      toastError({
        title: common("error_title"),
        // The API localizes its own messages, including the quota refusal.
        message:
          err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    },
    [toastError, common],
  );

  useEffect(() => {
    let active = true;
    fetchCohortBrief()
      .then((next) => {
        if (!active) return;
        setBrief(next);
        setLoaded(true);
      })
      .catch(() => {
        // The roster is the screen. A brief that failed to load must not blank it, and there is
        // nothing for the coach to do about it, so this stays quiet.
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function run() {
    setBusy(true);
    try {
      setBrief(await generateCohortBrief());
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  // Nothing rendered until the first read answers: a card that flashes "no brief yet" and then
  // fills in tells the coach something false for as long as the request takes.
  if (!loaded) return null;

  const hasLines = brief !== null && brief.items.length > 0;

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2
            className="text-base font-bold"
            style={{ color: "var(--color-main)" }}
          >
            {t("cohort_brief_title")}
          </h2>
          <Button type="button" variant="secondary" busy={busy} onClick={run}>
            {!busy && <RefreshCw aria-hidden size={15} strokeWidth={2} />}
            {brief ? t("cohort_brief_refresh") : t("cohort_brief_action")}
          </Button>
        </div>

        {brief === null ? (
          /*
           * No brief written yet. APP-090 tried a rule-based stand-in here and cut it: every line it
           * could produce — the name, the risk chips, the `action_*` suggestion — is already on the
           * `StudentCard` a few pixels below, so the card said the roster twice. What the model adds
           * is `why` (one reason drawn across several signals) and a situation-specific `action`,
           * and neither can be faked from the same row the coach is already looking at.
           */
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("cohort_brief_empty")}
          </p>
        ) : (
          <>
            <p
              className="text-pretty text-[15px] leading-relaxed"
              style={{ color: "var(--color-body)" }}
            >
              {/* An empty roster morning has no sentence to show, and inventing one would be the
                  model writing about nobody. The copy says the quiet part plainly instead. */}
              {brief.overall || t("cohort_brief_all_clear")}
            </p>
            {hasLines && (
              <ul
                className="flex flex-col gap-3"
                aria-label={t("cohort_brief_list_label")}
              >
                {brief.items.map((item) => (
                  <li
                    key={item.studentId}
                    className="flex flex-col gap-1.5 border-t pt-4"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--color-secondary) 14%, transparent)",
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={{
                          pathname: "/students/[studentId]",
                          params: { studentId: item.studentId },
                        }}
                        className="text-[15px] font-bold underline-offset-2 hover:underline"
                        style={{ color: "var(--color-main)" }}
                      >
                        {item.studentDisplayName}
                      </Link>
                      {item.isNew && <NewBadge>{t("cohort_brief_new")}</NewBadge>}
                      {item.riskFlags.map((flag) => (
                        <RiskChip key={flag} flag={flag} />
                      ))}
                    </div>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--color-body)" }}
                    >
                      {item.why}
                    </p>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {item.action}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
              {t("cohort_brief_since", {
                date: formatDate(brief.generatedAt, locale),
              })}
              {brief.model === "cache" ? ` · ${t("cohort_brief_cached")}` : ""}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
