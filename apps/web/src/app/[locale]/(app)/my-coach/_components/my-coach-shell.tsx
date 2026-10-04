"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MentorshipSharedDataDto, MyCoachDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { PANEL_GRID_CLASS, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";
import { PhoneVerificationCard } from "@/components/phone-verification-card";
import { useSubscription } from "@/lib/subscription-context";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { endMyCoachLink, fetchMyCoach, fetchSharedData } from "@/lib/mentorship";
import { MyCoachEmpty } from "./my-coach-empty";
import { MyCoachHero } from "./my-coach-hero";
import { MyCoachRail } from "./my-coach-rail";
import { MyNoteCard } from "./my-note-card";
import { MyWeeklyReportsCard } from "./my-weekly-reports-card";
import { SharedFollowupsCard } from "./shared-followups-card";

const TITLE = "text-display font-extrabold leading-tight tracking-[-0.01em] text-[var(--color-main)]";

/**
 * The student's side of the relationship, in the panel's frame: the coach and what passes between
 * them in the main column (who, notes, shared decisions, finalized weeks), and in the rail what the
 * coach sees, with the way to stop it under the data it stops. Below 1280 px the rail follows the
 * main column in reading order (a CSS grid, so no width change remounts the note editor).
 */
export function MyCoachShell() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const { error: toastError } = useMentorToast();
  const dialog = useMentorDialog();
  const { refresh: refreshSubscription } = useSubscription();
  const searchParams = useSearchParams();
  /** Read once: the invite page sends the student here with `?hosgeldin=1` right after they agree. */
  const [welcome] = useState(() => searchParams.get("hosgeldin") === "1");
  const [coach, setCoach] = useState<MyCoachDto | null>(null);
  const [shared, setShared] = useState<MentorshipSharedDataDto | null>(null);
  const [off, setOff] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const showError = useCallback(
    (err: unknown) => {
      toastError({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    },
    [toastError, common],
  );
  const showErrorRef = useRef(showError);
  useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  useEffect(() => {
    // Spend the greeting on arrival, so a refresh or a copied address does not greet again.
    if (welcome) window.history.replaceState(null, "", window.location.pathname);
  }, [welcome]);

  useEffect(() => {
    // Beside the coach fetch, never behind it (`standards/frontend.md`: no waterfalls). The mirror
    // is settled separately so a failure there cannot blank the screen: the numbers are the newer,
    // less important half, and "who can see my data and how do I stop it" has to render regardless.
    Promise.all([fetchMyCoach(), fetchSharedData().catch(() => null)])
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
        showErrorRef.current(err);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function endLink() {
    const confirmed = await dialog.confirm({
      title: t("my_coach_end_confirm_title"),
      message: t("my_coach_end_confirm_body"),
      confirmLabel: t("my_coach_end_confirm_action"),
      cancelLabel: t("confirm_cancel"),
      destructive: true,
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

  const body = (
    <div className="flex flex-col gap-5">
      <h1 className={TITLE}>{t("my_coach_title")}</h1>
      {off || coach === null ? (
        <MyCoachEmpty off={off} />
      ) : (
        <div className={PANEL_GRID_CLASS}>
          <div className="flex min-w-0 flex-col gap-5">
            <MyCoachHero coach={coach} welcome={welcome} />
            {coach.sponsoredPremiumPending ? (
              <section className="flex flex-col gap-3">
                <p className="text-sm text-[var(--color-secondary)]">{t("sponsored_premium_pending")}</p>
                <PhoneVerificationCard onStatusChange={(phone) => {
                  if (!phone.verified) return;
                  void Promise.all([fetchMyCoach(), refreshSubscription()]).then(([next]) => setCoach(next)).catch(showError);
                }} />
              </section>
            ) : null}
            <MyNoteCard
              note={coach.studentNote}
              onSaved={(studentNote) => setCoach((prev) => (prev ? { ...prev, studentNote } : prev))}
            />
            <SharedFollowupsCard />
            <MyWeeklyReportsCard coachName={coach.coachDisplayName} />
          </div>
          <MyCoachRail scope={coach.dataScope} values={shared} busy={busy} onEnd={endLink} />
        </div>
      )}
    </div>
  );

  return (
    <div className={PANEL_MAIN_CLASS}>
      <SkeletonGroup
        label={t("loading")}
        loading={!loaded}
        revealed={loaded ? body : <div className="h-52" aria-hidden />}
      >
        <div className="flex flex-col gap-5">
          <Skeleton className="h-9 w-40 rounded-[var(--radius-card)]" />
          <div className={PANEL_GRID_CLASS}>
            <div className="flex flex-col gap-5">
              <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
              <Skeleton className="h-32 w-full rounded-[var(--radius-card)]" />
            </div>
            <Skeleton className="h-96 w-full rounded-[var(--radius-card)]" />
          </div>
        </div>
      </SkeletonGroup>
    </div>
  );
}
