"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card } from "@mentor/ui";
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
 * The rule-based risk chips stay above this card and are not replaced by it: a deterministic flag
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
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
            {t("brief_title")}
          </h2>
          <Button type="button" variant="soft" busy={busy} onClick={run}>
            {brief ? t("brief_refresh") : t("brief_action")}
          </Button>
        </div>
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {brief ? t("brief_body") : t("brief_empty")}
        </p>
        {brief && (
          <>
            <p className="whitespace-pre-line text-sm" style={{ color: "var(--color-body)" }}>
              {brief.text}
            </p>
            <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
              {t("brief_since", { date: formatDate(brief.at, locale) })}
              {brief.cached ? ` · ${t("brief_cached")}` : ""}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
