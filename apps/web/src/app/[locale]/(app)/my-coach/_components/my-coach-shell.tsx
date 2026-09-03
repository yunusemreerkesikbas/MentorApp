"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MyCoachDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, SectionHeading, Skeleton, SkeletonGroup } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { endMyCoachLink, fetchMyCoach } from "@/lib/mentorship";

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
    fetchMyCoach()
      .then(setCoach)
      .catch(showError)
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

  if (!loaded) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 lg:py-10">
        <SkeletonGroup label={t("loading")}>
          <Skeleton className="h-10 w-48 rounded-[var(--radius-card)]" />
          <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" />
        </SkeletonGroup>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6 sm:px-8 lg:py-10">
      <SectionHeading>{t("my_coach_title")}</SectionHeading>

      {coach === null ? (
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

          <DataScopeCard scope={coach.dataScope} />
        </>
      )}
    </div>
  );
}

/**
 * The consent contract, rendered. `dataScope` comes from the API rather than being hardcoded here,
 * so this list cannot drift from what the server actually sends a coach.
 */
export function DataScopeCard({ scope }: { scope: readonly string[] }) {
  const t = useTranslations("mentorship");
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
          {t("scope_title")}
        </h2>
        <ul
          className="flex list-disc flex-col gap-1 pl-5 text-sm"
          style={{ color: "var(--color-secondary)" }}
        >
          {scope.map((key) => (
            <li key={key}>{t(`scope_${key}`)}</li>
          ))}
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
