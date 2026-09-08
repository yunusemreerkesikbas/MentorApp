"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  MentorshipApplicationDto,
  MentorshipCoachRegistrationStateDto,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, Chip, SectionHeading, TextAreaField, TextField } from "@mentor/ui";
import { FormError } from "@/components/form";
import { Link } from "@/i18n/navigation";
import { fetchCoachRegistrationState, updateCoachProfile } from "@/lib/mentorship";

/**
 * The coach's own profile page (APP-090 moved it here from `/koc-basvurusu`).
 *
 * Self-fetching because it is a page root now, not a card the registration screen handed props to.
 * The endpoint is the same one the roster header reads, so this costs a call the coach was already
 * making elsewhere and nothing new was built for it.
 */
export function CoachProfileShell() {
  const t = useTranslations("mentorship");
  const [state, setState] = useState<MentorshipCoachRegistrationStateDto | null>(null);

  const load = useCallback(() => {
    fetchCoachRegistrationState()
      .then(setState)
      .catch(() => {
        // Unknown rather than wrong: the skeleton holds instead of claiming a standing.
      });
  }, []);

  useEffect(load, [load]);

  if (state === null) return <div className="h-72" aria-hidden />;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading subtitle={t("application_subtitle")}>
        {t("application_title")}
      </SectionHeading>

      {state.registration === null ? (
        /* A coach who holds the role without a registry row — an admin designated them and they
           have not written their own two lines yet. `assertCanInvite` keeps their invite code shut
           until they do, so the form is the whole point of sending them here. */
        <Card>
          <p className="text-sm" style={{ color: "var(--color-body)" }}>
            {t("coach_profile_missing")}
          </p>
          <div className="mt-3">
            <Link href="/coach-application">
              <Button>{t("registration_submit")}</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <ProfileStandingCard
          registration={state.registration}
          emailVerified={state.emailVerified}
          onUpdated={(registration) =>
            setState((current) => (current === null ? current : { ...current, registration }))
          }
        />
      )}
    </div>
  );
}

/**
 * Where the account stands, and the editor for the two student-facing lines.
 *
 * Three standings, three different things the coach needs (APP-089):
 *   ACTIVE     the panel, open now, plus the editor. If the email is still unverified the panel
 *              works but the invite code does not, and that is the one thing worth saying here.
 *   PENDING    an admin is looking. Nothing to do, so nothing is offered.
 *   SUSPENDED  the admin's reason, verbatim, and no door back — registering again is refused, so
 *              offering a button would be offering a dead end.
 */
function ProfileStandingCard({
  registration,
  emailVerified,
  onUpdated,
}: {
  registration: MentorshipApplicationDto;
  emailVerified: boolean;
  onUpdated: (next: MentorshipApplicationDto) => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decidedOn =
    registration.reviewedAt === null
      ? null
      : new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
          new Date(registration.reviewedAt),
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
            defaultValue={registration.headline}
            maxLength={120}
            required
          />
          <TextAreaField
            name="bio"
            label={t("application_bio_label")}
            defaultValue={registration.bio}
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

  const active = registration.status === "ACTIVE";

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold" style={{ color: "var(--color-main)" }}>
            {registration.headline}
          </span>
          <Chip size="sm" className="normal-case">
            {t(`coach_status_${registration.status}`)}
          </Chip>
        </div>

        <p className="text-sm" style={{ color: "var(--color-body)" }}>
          {t(`coach_status_${registration.status}_body`)}
        </p>

        {/* The bio is student-facing only while the account stands, so it is only echoed back then. */}
        {active && (
          <p className="text-sm whitespace-pre-line" style={{ color: "var(--color-body)" }}>
            {registration.bio}
          </p>
        )}

        {/* The one blocker a coach can clear themselves. Everything else on this card is somebody
            else's decision; this is the sentence that turns a locked invite code into a next step. */}
        {active && !emailVerified && (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("coach_email_unverified")}
          </p>
        )}

        {/* The admin's words, shown as written. One-way: this is a decision, not a conversation. */}
        {registration.reviewNote !== null && (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {registration.reviewNote}
            {decidedOn !== null && ` · ${decidedOn}`}
          </p>
        )}

        {/* What an admin actually checked — never "this coach is good", only "this was verified".
            An empty list is now the normal case, and the student's screen says so out loud rather
            than leaving the absence to be read as approval. */}
        {registration.verifiedClaims.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5">
            {registration.verifiedClaims.map((claim) => (
              <li key={claim}>
                <Chip size="sm" className="normal-case">
                  {t(`application_claim_${claim}`)}
                </Chip>
              </li>
            ))}
          </ul>
        )}

        {active && (
          <div className="flex flex-wrap gap-2">
            <Link href="/students">
              <Button>{t("application_open_panel")}</Button>
            </Link>
            {/* Editing lives here rather than on its own screen because the ACTIVE registration IS
                the profile — a second route would render the same row twice. */}
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {t("profile_edit")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
