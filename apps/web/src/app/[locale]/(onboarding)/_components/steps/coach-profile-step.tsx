"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { TextAreaField, TextField } from "@mentor/ui";
import { FormError } from "@/components/form";
import { registerCoach } from "@/lib/mentorship";
import { OnboardingStepLayout } from "../onboarding-step-layout";

const FORM_ID = "onboarding-coach-profile-form";

/**
 * The coach's last onboarding step, where the student's goal question used to be (APP-089).
 *
 * This is the call that actually makes them a coach: it writes the registry row and the API grants
 * COACH off the back of it. So it cannot be skippable the way the goal step is — a coach who
 * skipped would land on a panel with a locked invite code and no explanation.
 *
 * The two required fields are the two a STUDENT reads on the consent screen. Nobody reviews them
 * before that happens any more, which is why `headline` and `bio` are refused if they carry contact
 * details (the API checks; this screen shows what it says). The three claims stay optional: a claim
 * you do not make is one nobody has to check, and an unchecked one is labelled as the coach's own
 * word wherever it is shown.
 */
export function CoachProfileStep({
  onSaved,
  onBack,
}: {
  onSaved: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("onboarding.coach_profile");
  const mentorship = useTranslations("mentorship");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [institution, setInstitution] = useState("");
  const [branch, setBranch] = useState("");
  const [years, setYears] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = (value: string) => (value.trim() === "" ? null : value.trim());
  const canSave = headline.trim() !== "" && bio.trim() !== "" && !saving;

  async function handleSave() {
    if (!canSave) return;
    setError(null);
    setSaving(true);
    try {
      await registerCoach({
        headline: headline.trim(),
        bio: bio.trim(),
        institution: trimmed(institution),
        branch: trimmed(branch),
        // Left null rather than NaN when the box is empty: the API bounds this 0-60 and a NaN
        // would come back as a validation error the coach cannot act on.
        years: years.trim() === "" ? null : Number(years),
        note: null,
      });
      onSaved();
    } catch (err) {
      // The contact-detail refusal lands here with its own localized message, so showing the API's
      // words beats inventing a second explanation of the same rule.
      setError(err instanceof ApiClientError ? err.body.message : t("save_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingStepLayout
      step={4}
      mascot="proud"
      title={t("title")}
      subtitle={t("subtitle")}
      onBack={onBack}
      primaryLabel={t("save")}
      primaryFormId={FORM_ID}
      primaryBusy={saving}
      primaryDisabled={!canSave}
    >
      <form
        id={FORM_ID}
        className="mx-auto flex w-full max-w-xl flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <FormError message={error} />

        <TextField
          label={mentorship("application_headline_label")}
          placeholder={mentorship("application_headline_placeholder")}
          value={headline}
          maxLength={120}
          disabled={saving}
          autoFocus
          required
          onChange={(e) => setHeadline(e.target.value)}
        />
        <TextAreaField
          label={mentorship("application_bio_label")}
          placeholder={mentorship("application_bio_placeholder")}
          value={bio}
          maxLength={1000}
          rows={4}
          disabled={saving}
          required
          onChange={(e) => setBio(e.target.value)}
        />

        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("claims_intro")}
        </p>
        <TextField
          label={mentorship("application_institution_label")}
          value={institution}
          maxLength={160}
          disabled={saving}
          onChange={(e) => setInstitution(e.target.value)}
        />
        <TextField
          label={mentorship("application_branch_label")}
          value={branch}
          maxLength={80}
          disabled={saving}
          onChange={(e) => setBranch(e.target.value)}
        />
        <TextField
          label={mentorship("application_years_label")}
          type="number"
          min={0}
          max={60}
          value={years}
          disabled={saving}
          onChange={(e) => setYears(e.target.value)}
        />
      </form>
    </OnboardingStepLayout>
  );
}
