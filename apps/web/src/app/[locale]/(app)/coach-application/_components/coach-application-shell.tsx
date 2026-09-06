"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipApplicationDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, SectionHeading, TextAreaField, TextField } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchMyCoachApplication, submitCoachApplication } from "@/lib/mentorship";
import { ApplicationStatusCard } from "./application-status-card";

/**
 * Becoming a coach (roadmap §5: curation, not open registration).
 *
 * One screen, three states: closed / no application yet (the form) / an application with a verdict.
 * The form is not shown next to a live application — an applicant with an outstanding decision has
 * nothing to submit, and offering the box would invite them to try.
 */
export function CoachApplicationShell() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();

  const [application, setApplication] = useState<MentorshipApplicationDto | null>(null);
  const [closed, setClosed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyCoachApplication()
      .then(setApplication)
      .catch(() => {
        /* Reading my own application must not blank the screen; the form still stands. */
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(load, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = String(data.get(key) ?? "").trim();
      return value === "" ? null : value;
    };
    const years = text("years");

    setBusy(true);
    setError(null);
    try {
      const created = await submitCoachApplication({
        headline: String(data.get("headline") ?? "").trim(),
        bio: String(data.get("bio") ?? "").trim(),
        institution: text("institution"),
        branch: text("branch"),
        years: years === null ? null : Number(years),
        note: text("note"),
      });
      setApplication(created);
      toast.success({ title: t("application_sent_title"), message: t("application_sent_body") });
    } catch (err) {
      // The tap being closed is a state, not a failure: the row that leads here stays visible, so
      // a red toast on a screen somebody just opened would read as a bug.
      if (err instanceof ApiClientError && err.body.code === "MENTORSHIP_APPLICATIONS_CLOSED") {
        setClosed(true);
        return;
      }
      setError(err instanceof ApiClientError ? err.message : common("error_unknown"));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <div className="h-72" aria-hidden />;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading subtitle={t("application_subtitle")}>
        {t("application_title")}
      </SectionHeading>

      {closed ? (
        <EmptyState
          title={t("application_closed_title")}
          description={t("application_closed_body")}
          puhuVariant="encouraging"
        />
      ) : application !== null ? (
        <ApplicationStatusCard
          application={application}
          onReapply={() => setApplication(null)}
          onUpdated={setApplication}
        />
      ) : (
        <Card>
          <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
            <TextField
              name="headline"
              label={t("application_headline_label")}
              placeholder={t("application_headline_placeholder")}
              maxLength={120}
              required
            />
            <TextAreaField
              name="bio"
              label={t("application_bio_label")}
              placeholder={t("application_bio_placeholder")}
              maxLength={1000}
              rows={5}
              required
            />

            {/* Structured, not prose: an admin marks WHICH of these they checked, and a paragraph
                cannot be verified. Each one is optional — a claim you do not make is one nobody
                has to check. */}
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("application_claims_intro")}
            </p>
            <TextField name="institution" label={t("application_institution_label")} maxLength={160} />
            <TextField name="branch" label={t("application_branch_label")} maxLength={80} />
            <TextField
              name="years"
              type="number"
              min={0}
              max={60}
              label={t("application_years_label")}
            />
            <TextAreaField
              name="note"
              label={t("application_note_label")}
              placeholder={t("application_note_placeholder")}
              maxLength={1000}
              rows={3}
            />

            <FormError message={error} />
            <Button type="submit" busy={busy}>
              {t("application_submit")}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
