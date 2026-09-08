"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipSharedDataDto, MyCoachDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, SectionHeading, Skeleton, SkeletonGroup } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { endMyCoachLink, fetchMyCoach, fetchSharedData } from "@/lib/mentorship";
import { CoachProfileCard } from "./coach-profile-card";
import { scopeValue } from "./scope-values";

/**
 * The student's transparency screen. Its job is not to manage a relationship — it is to answer
 * "who can see my data, exactly what, and how do I stop it", on one page, without asking anyone.
 */
export function MyCoachShell() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const toast = useMentorToast();
  const dialog = useMentorDialog();
  const [coach, setCoach] = useState<MyCoachDto | null>(null);
  const [shared, setShared] = useState<MentorshipSharedDataDto | null>(null);
  const [off, setOff] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const showError = useCallback(
    (err: unknown) => {
      toast.error({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    },
    [toast, common],
  );

  const load = useCallback(() => {
    // Beside the coach fetch, never behind it (`standards/frontend.md`: no waterfalls). The mirror
    // is settled separately so a failure there cannot blank the screen: the numbers are the newer,
    // less important half, and "who can see my data and how do I stop it" has to render regardless.
    Promise.all([
      fetchMyCoach(),
      fetchSharedData().catch(() => null),
    ])
      .then(([myCoach, sharedData]) => {
        setCoach(myCoach);
        setShared(sharedData);
      })
      .catch((err: unknown) => {
        // The kill-switch is a state, not a failure. The profile row that leads here is always
        // visible, so an error toast would read as a bug on a screen the student just opened.
        if (err instanceof ApiClientError && err.body.code === "MENTORSHIP_DISABLED") {
          setOff(true);
          return;
        }
        showError(err);
      })
      .finally(() => setLoaded(true));
  }, [showError]);

  useEffect(load, [load]);

  async function endLink() {
    const confirmed = await dialog.confirm({
      title: t("my_coach_end_confirm_title"),
      message: t("my_coach_end_confirm_body"),
      confirmLabel: t("my_coach_end_confirm_action"),
      cancelLabel: t("confirm_cancel"),
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await endMyCoachLink();
      setCoach(null);
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  const body = !loaded ? (
    <div className="h-52" aria-hidden />
  ) : (
    <div className="flex flex-col gap-6">
      <SectionHeading>{t("my_coach_title")}</SectionHeading>

      {off ? (
        <EmptyState
          title={t("my_coach_off_title")}
          description={t("my_coach_off_body")}
          puhuVariant="encouraging"
        />
      ) : coach === null ? (
        <EmptyState
          title={t("my_coach_empty_title")}
          description={t("my_coach_empty_body")}
          puhuVariant="encouraging"
          action={
            <Link href="/coach-invitation">
              <Button>{t("invitation_title")}</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold" style={{ color: "var(--color-main)" }}>
                  {coach.coachDisplayName}
                </p>
                {coach.acceptedAt ? (
                  <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                    {t("my_coach_since", {
                      date: new Intl.DateTimeFormat(locale, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(coach.acceptedAt)),
                    })}
                  </p>
                ) : null}
              </div>
              <Button variant="ghost" busy={busy} onClick={endLink}>
                {t("my_coach_end")}
              </Button>
            </div>
          </Card>

          {/* An admin stopped this coach (APP-089). The link is untouched and nothing was ended, but
              they can no longer open this student's report — and a coach who has gone quiet for an
              administrative reason otherwise reads as a coach who stopped caring. */}
          {coach.coachStatus !== null && coach.coachStatus !== "ACTIVE" && (
            <Card>
              <p className="text-sm" style={{ color: "var(--color-body)" }}>
                {t("my_coach_suspended")}
              </p>
            </Card>
          )}

          {/* Re-readable after the fact: a student who agreed to something should not have to dig
              out the invite they used months ago to remember who they agreed with. */}
          <CoachProfileCard profile={coach.coachProfile} />

          {coach.coachNote ? (
            <Card>
              <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
                {t("my_coach_note_title")}
              </h2>
              <p className="whitespace-pre-line text-sm" style={{ color: "var(--color-main)" }}>
                {coach.coachNote.body}
              </p>
              <p className="mt-2 text-xs" style={{ color: "var(--color-secondary)" }}>
                {t("my_coach_note_since", {
                  date: new Intl.DateTimeFormat(locale, {
                    day: "numeric",
                    month: "long",
                  }).format(new Date(coach.coachNote.updatedAt)),
                })}
              </p>
            </Card>
          ) : null}

          <DataScopeCard scope={coach.dataScope} values={shared} />
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 lg:py-10">
      <SkeletonGroup
        label={t("loading")}
        loading={!loaded}
        revealed={body}
        className="flex flex-col gap-4"
      >
        <Skeleton className="h-10 w-48 rounded-[var(--radius-card)]" />
        <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-32 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    </div>
  );
}

/**
 * The consent contract, rendered. `dataScope` comes from the API rather than being hardcoded here,
 * so this list cannot drift from what the server actually sends a coach.
 *
 * `values` is optional because this card serves two moments. On the consent screen the link does
 * not exist yet, so there is nothing to report and the list stays a promise. On `/kocum` the link
 * is live, and each line gains the figure actually travelling — the same argument APP-073 made for
 * giving the COACH a scope mirror, pointed the other way: the side handing data over should not
 * know less about it than the side receiving it.
 */
export function DataScopeCard({
  scope,
  values,
}: {
  scope: readonly string[];
  values?: MentorshipSharedDataDto | null;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
          {t("scope_title")}
        </h2>
        <ul
          className="flex list-disc flex-col gap-2 pl-5 text-sm"
          style={{ color: "var(--color-secondary)" }}
        >
          {scope.map((key) => {
            const value = values ? scopeValue(key, values, t, locale) : null;
            return (
              <li key={key}>
                {t(`scope_${key}`)}
                {value !== null && (
                  <span className="mt-0.5 block" style={{ color: "var(--color-body)" }}>
                    {value}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {/* What the coach can WRITE, not see — so it sits beside the list, not inside it. */}
        <p className="mt-3 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("scope_coach_writes")}
        </p>
      </Card>
      <Card>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
          {t("scope_never_title")}
        </h2>
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("scope_never_body")}
        </p>
      </Card>
    </div>
  );
}
