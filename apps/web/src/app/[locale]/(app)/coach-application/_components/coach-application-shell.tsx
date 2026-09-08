"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipCoachRegistrationStateDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, SectionHeading, TextAreaField, TextField } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchCoachRegistrationState, registerCoach } from "@/lib/mentorship";
import { ApplicationStatusCard } from "./application-status-card";

/**
 * Becoming a coach, and being one (roadmap §5 as revised by APP-089).
 *
 * Registration is self-service now, so this screen changed job: it used to collect an application
 * somebody would later read, and it now writes the profile a student reads immediately. Three
 * states, and only the first two are entered from here:
 *
 *   intake shut     nothing to fill in, and we can say so BEFORE the form is filled — the state
 *                   arrives with the page instead of being discovered by a rejected submission.
 *   no registration the form. Submitting it grants COACH.
 *   registered      the profile, editable, with the standing and any admin note beside it.
 *
 * The signup route (`/kayit?rol=koc`) walks a new coach through onboarding instead, which ends by
 * calling the same endpoint. This screen stays because an existing account — a student who decides
 * to coach, or somebody an admin designated — has no onboarding left to run.
 */
export function CoachApplicationShell() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();

  const [state, setState] = useState<MentorshipCoachRegistrationStateDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchCoachRegistrationState()
      .then(setState)
      .catch(() => {
        // Reading my own registration must not blank the screen. `state` stays null and the
        // skeleton below holds, which is honest: we do not know, so we claim nothing.
      });
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
      const created = await registerCoach({
        headline: String(data.get("headline") ?? "").trim(),
        bio: String(data.get("bio") ?? "").trim(),
        institution: text("institution"),
        branch: text("branch"),
        years: years === null ? null : Number(years),
        note: text("note"),
      });
      setState((current) =>
        current === null ? current : { ...current, registration: created },
      );
      toast.success({ title: t("registration_done_title"), message: t("registration_done_body") });
    } catch (err) {
      // The intake closing between page load and submit lands here. It is a state, not a failure,
      // so the screen swaps rather than flashing red.
      if (err instanceof ApiClientError && err.body.code === "MENTORSHIP_APPLICATIONS_CLOSED") {
        setState((current) => (current === null ? current : { ...current, registrationOpen: false }));
        return;
      }
      setError(err instanceof ApiClientError ? err.message : common("error_unknown"));
    } finally {
      setBusy(false);
    }
  }

  if (state === null) return <div className="h-72" aria-hidden />;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading subtitle={t("application_subtitle")}>
        {t("application_title")}
      </SectionHeading>

      {state.registration !== null ? (
        <ApplicationStatusCard
          registration={state.registration}
          emailVerified={state.emailVerified}
          onUpdated={(registration) =>
            setState((current) => (current === null ? current : { ...current, registration }))
          }
        />
      ) : !state.registrationOpen ? (
        <EmptyState
          title={t("application_closed_title")}
          description={t("application_closed_body")}
          puhuVariant="encouraging"
        />
      ) : (
        <Card>
          <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
            {/* Nobody reads this before a student does. The two fields below go straight onto the
                consent screen, which is why the API refuses contact details in them. */}
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

            {/* Structured, not prose: an admin can only mark WHICH of these they checked, and a
                paragraph cannot be checked. Each one is optional — a claim you do not make is one
                nobody has to check, and until somebody does, students are shown it as your word. */}
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("registration_claims_intro")}
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
              {t("registration_submit")}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
