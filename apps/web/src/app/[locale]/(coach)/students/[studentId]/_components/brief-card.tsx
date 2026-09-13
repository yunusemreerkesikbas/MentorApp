"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { INSET_GROUP_CLASS, InsetSection, TextButton } from "@/components/mentorship/coach-ui";
import { useMentorToast } from "@/lib/mentor-toast";
import { generateBrief } from "@/lib/mentorship";
import { formatDate } from "../../../_components/mentorship-format";

/**
 * The coach's AI brief over this student's report (roadmap §9's "koç zekâ katmanı").
 *
 * Nothing is requested on mount. The brief costs an LLM call and a quota unit, so it happens only
 * when the coach asks — a card that wrote itself on every page view would bill a coach for reading
 * their own roster.
 *
 * The parent keys this component by `studentId`, so moving between students remounts it: the state
 * resets and an in-flight reply lands on a dead instance instead of the new student's screen. A
 * brief is an AI summary of one student's numbers, and showing it under another student's name is
 * the one failure this card cannot have.
 *
 * The rule-based risk chips stay in the header and are not replaced by it: a deterministic flag
 * a coach can trust beats a sentence they have to second-guess, and the brief says so in its copy.
 */
export function BriefCard({ studentId }: { studentId: string }) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const toast = useMentorToast();
  const [brief, setBrief] = useState<{ text: string; at: string; cached: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const result = await generateBrief(studentId);
      setBrief({
        text: result.brief,
        at: result.generatedAt,
        cached: result.model === "cache",
      });
    } catch (err) {
      toast.error({
        title: common("error_title"),
        // The API localizes its own messages, including the quota refusal.
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <InsetSection
      title={t("brief_title")}
      action={
        brief ? (
          <TextButton aria-busy={busy || undefined} disabled={busy} onClick={run}>
            {t("brief_refresh")}
          </TextButton>
        ) : null
      }
    >
      {brief ? (
        <div className={`${INSET_GROUP_CLASS} flex flex-col gap-2.5 p-4`}>
          <p className="coach-body max-w-[68ch] whitespace-pre-line text-pretty text-[var(--color-body)]">
            {brief.text}
          </p>
          <p className="coach-footnote text-[var(--color-secondary)]">
            {t("brief_since", { date: formatDate(brief.at, locale) })}
            {brief.cached ? ` · ${t("brief_cached")}` : ""}
          </p>
          <p className="coach-footnote text-[var(--color-secondary)]">{t("brief_body")}</p>
        </div>
      ) : (
        <div className={`${INSET_GROUP_CLASS} flex flex-wrap items-center justify-between gap-3 p-4`}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="coach-body text-[var(--color-main)]">{t("brief_empty")}</p>
            <p className="coach-footnote text-[var(--color-secondary)]">{t("brief_body")}</p>
          </div>
          <Button type="button" variant="soft" size="sm" className="min-h-11" busy={busy} onClick={run}>
            {t("brief_action")}
          </Button>
        </div>
      )}
    </InsetSection>
  );
}
