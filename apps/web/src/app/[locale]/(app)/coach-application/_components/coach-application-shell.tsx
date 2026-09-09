"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { AuthUser, MentorshipCoachRegistrationStateDto } from "@mentor/types";
import { ApiClientError, usersControllerMe } from "@mentor/api-client";
import { Button, Card, Chip, SectionHeading, TextAreaField, TextField } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form";
import { useMentorToast } from "@/lib/mentor-toast";
import { useAuth } from "@/lib/auth-context";
import { isCoach } from "@/lib/coach-surface";
import { useRouter } from "@/i18n/navigation";
import { fetchCoachRegistrationState, registerCoach } from "@/lib/mentorship";

/**
 * BECOMING a coach (roadmap §5 as revised by APP-089). Being one is `/kocluk/profil`.
 *
 * This screen used to do both jobs, and APP-090 split them by who reaches them. A coach no longer
 * walks the student surface at all — `isStudentOnlyPath` closes the daily ritual to them — so an
 * editor sitting in `(app)` would be the one screen dragging them back into a world they left.
 * The form stays because whoever fills it in is, by definition, not a coach yet.
 *
 * Two states now:
 *   intake shut     nothing to fill in, and we say so BEFORE the form is filled — the state arrives
 *                   with the page instead of being discovered by a rejected submission.
 *   no registration the form. Submitting it grants COACH.
 *
 * A third case is a redirect rather than a state: somebody who already has a registry row is sent
 * to their profile. That happens after a successful submit too, which is why there is no success
 * card here — the coach lands on the thing they just created.
 *
 * The signup route (`/kayit?rol=koc`) walks a new coach through onboarding instead, which ends by
 * calling the same endpoint. This screen stays for an existing account: a student who decides to
 * coach, or somebody an admin designated, has no onboarding left to run.
 */
export function CoachApplicationShell() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const router = useRouter();
  const { user, setUserFromServer } = useAuth();

  const [state, setState] = useState<MentorshipCoachRegistrationStateDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The editor lives on the coach surface, and only somebody holding COACH can open it.
   *
   * The ROLE, not the registry row, is the condition — and getting that wrong locks a suspended
   * coach out of the one screen that tells them why. Suspension revokes COACH (APP-089) but leaves
   * the row with the admin's reason on it, so a redirect keyed on the row would bounce them into
   * `(coach)`'s guard and they would never read it.
   */
  const editable = isCoach(user) && state?.registration != null;
  /** A row without the role: PENDING or SUSPENDED. Read-only, and it stays on this side. */
  const standing = !isCoach(user) ? (state?.registration ?? null) : null;

  const load = useCallback(() => {
    fetchCoachRegistrationState()
      .then(setState)
      .catch(() => {
        // Reading my own registration must not blank the screen. `state` stays null and the
        // skeleton below holds, which is honest: we do not know, so we claim nothing.
      });
  }, []);

  useEffect(load, [load]);

  // Already a coach: their profile is the screen they wanted, and it lives on the coach surface.
  // Also the exit after a successful submit — registration grants COACH, and the guard re-reads
  // the principal from the DB on the next request, so `editable` flips without a re-login.
  useEffect(() => {
    if (editable) router.replace("/students/profile");
  }, [editable, router]);

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

      /*
       * Pull the principal again before leaving. Registration granted COACH server-side and the
       * guard re-reads roles from the database on the next request, but the copy held in this tab
       * is the one from login — and `(coach)`'s own guard reads THAT. Navigating without this
       * would land a brand-new coach on "bu alan koçlar için".
       */
      try {
        setUserFromServer((await usersControllerMe()) as unknown as AuthUser);
      } catch {
        // The role is real regardless; the next silent refresh picks it up. Worst case the coach
        // lands on the guard and one reload fixes it, which beats staying on a stale form.
      }
      router.replace("/students/profile");
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

  // The placeholder holds while the redirect above lands, so the form never flashes for somebody
  // who is already a coach.
  if (state === null || editable) return <div className="h-72" aria-hidden />;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading subtitle={t("application_subtitle")}>
        {t("application_title")}
      </SectionHeading>

      {standing !== null ? (
        /* PENDING or SUSPENDED: the role is gone, so the coach surface is shut to them and this is
           the only place the admin's decision can be read. Read-only on purpose — editing the two
           student-facing lines needs an ACTIVE standing, which is exactly what they do not have. */
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold" style={{ color: "var(--color-main)" }}>
                {standing.headline}
              </span>
              <Chip size="sm" className="normal-case">
                {t(`coach_status_${standing.status}`)}
              </Chip>
            </div>
            <p className="text-sm" style={{ color: "var(--color-body)" }}>
              {t(`coach_status_${standing.status}_body`)}
            </p>
            {/* The admin's words, shown as written. One-way: a decision, not a conversation. */}
            {standing.reviewNote !== null && (
              <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                {standing.reviewNote}
              </p>
            )}
          </div>
        </Card>
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
