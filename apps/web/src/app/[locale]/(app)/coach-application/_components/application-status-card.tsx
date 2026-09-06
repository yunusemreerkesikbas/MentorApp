"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipApplicationDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, Chip, TextAreaField, TextField } from "@mentor/ui";
import { FormError } from "@/components/form";
import { Link } from "@/i18n/navigation";
import { updateCoachProfile } from "@/lib/mentorship";

/**
 * What happened to my application.
 *
 * Three verdicts, three different things the applicant needs. Pending: nothing to do, so nothing
 * is offered. Rejected: the admin's reason, verbatim, and the door back in. Approved: the panel,
 * open now — the role is live on the applicant's current session, no re-login.
 */
export function ApplicationStatusCard({
  application,
  onReapply,
  onUpdated,
}: {
  application: MentorshipApplicationDto;
  onReapply: () => void;
  onUpdated: (next: MentorshipApplicationDto) => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decidedOn =
    application.reviewedAt === null
      ? null
      : new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
          new Date(application.reviewedAt),
        );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      onUpdated(
        await updateCoachProfile({
          headline: String(data.get("headline") ?? "").trim(),
          bio: String(data.get("bio") ?? "").trim(),
        }),
      );
      setEditing(false);
    } catch (err) {
      // The contact-pattern refusal lands here. It is a 400 with its own message, so showing the
      // API's own words beats inventing a second explanation of the same rule.
      setError(err instanceof ApiClientError ? err.message : common("error_unknown"));
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
          <TextField
            name="headline"
            label={t("application_headline_label")}
            defaultValue={application.headline}
            maxLength={120}
            required
          />
          <TextAreaField
            name="bio"
            label={t("application_bio_label")}
            defaultValue={application.bio}
            maxLength={1000}
            rows={5}
            required
          />
          {/* The claims and the badges are NOT here. They are what an admin checked, and a coach
              who could rewrite them would be rewriting somebody else's verification. */}
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("profile_edit_claims_locked")}
          </p>
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" busy={busy}>
              {t("profile_edit_save")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {t("confirm_cancel")}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold" style={{ color: "var(--color-main)" }}>
            {application.headline}
          </span>
          <Chip size="sm" className="normal-case">
            {t(`application_status_${application.status}`)}
          </Chip>
        </div>

        <p className="text-sm" style={{ color: "var(--color-body)" }}>
          {t(`application_status_${application.status}_body`)}
        </p>

        {/* The bio only becomes student-facing once approved, so it is only echoed back here. */}
        {application.status === "APPROVED" && (
          <p className="text-sm whitespace-pre-line" style={{ color: "var(--color-body)" }}>
            {application.bio}
          </p>
        )}

        {/* The admin's words, shown as written. One-way: this is a verdict, not a conversation. */}
        {application.reviewNote !== null && (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {application.reviewNote}
            {decidedOn !== null && ` · ${decidedOn}`}
          </p>
        )}

        {/* What an admin actually checked — never "this coach is good", only "this was verified". */}
        {application.verifiedClaims.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5">
            {application.verifiedClaims.map((claim) => (
              <li key={claim}>
                <Chip size="sm" className="normal-case">
                  {t(`application_claim_${claim}`)}
                </Chip>
              </li>
            ))}
          </ul>
        )}

        {application.status === "APPROVED" && (
          <div className="flex flex-wrap gap-2">
            <Link href="/students">
              <Button>{t("application_open_panel")}</Button>
            </Link>
            {/* Editing lives here rather than on its own screen because the approved application
                IS the profile — a second route would render the same row twice. */}
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {t("profile_edit")}
            </Button>
          </div>
        )}
        {application.status === "REJECTED" && (
          // The form comes back only when the wait is over; before that the API refuses and says
          // how long. Offering the button anyway beats hiding the door and explaining nothing.
          <Button variant="secondary" onClick={onReapply}>
            {t("application_reapply")}
          </Button>
        )}
      </div>
    </Card>
  );
}
