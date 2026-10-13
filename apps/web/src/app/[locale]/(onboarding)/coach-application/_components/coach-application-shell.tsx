"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AuthUser, MentorshipCoachRegistrationStateDto } from "@mentor/types";
import { usersControllerMe } from "@mentor/api-client";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { isCoach } from "@/lib/coach-surface";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchCoachRegistrationState } from "@/lib/mentorship";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";
import { OnboardingDirectionProvider } from "../../_components/onboarding-direction";
import { OnboardingStepLayout } from "../../_components/onboarding-step-layout";
import { CoachProfileStep } from "../../_components/steps/coach-profile-step";
import { ChangeStep, GateNotice } from "./become-coach-steps";

type Step = "change" | "profile";

const LEDGE_LINK = `${LEDGE} ${LEDGE_FILLED} w-full`;

/**
 * An existing account becoming a coach (roadmap §5 as revised by APP-089). Being one is `/kocluk/profil`.
 *
 * Not an application: nobody approves it, the account opens on submit. What it is instead is a
 * one-way switch. COACH closes the student's own screens on this account (`lib/coach-surface.ts`)
 * and nobody can undo that themselves, so the flow says so first and asks once more at the end.
 * A new coach never sees this screen: `/kayit?rol=koc` walks them through onboarding instead.
 *
 * Every reason there is no form arrives with the page, never as a refused submit:
 *   a registry row without the role   PENDING or SUSPENDED. Read-only, and it stays on this side:
 *                                     the role is gone, so this is the only screen the admin's
 *                                     reason can be read on.
 *   intake shut                       `mentorship.applications.open`.
 *   somebody's student                the API refuses while the link stands, because a coach
 *                                     cannot open `/kocum` to see or end it.
 *
 * An unverified email or phone is NOT one of them, and this flow does not ask for either. Both
 * open the invite code, not the account, and the coach's panel asks for them there. They stood in
 * the way once, and becoming a coach then depended on a mail and an SMS provider being up.
 *
 * Somebody who already holds COACH with a row is sent to their profile. One who holds it without a
 * row (an admin designated them) skips the first step: nothing closes for them.
 */
export function CoachApplicationShell() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const dialog = useMentorDialog();
  const router = useRouter();
  const { user, setUserFromServer } = useAuth();

  const [state, setState] = useState<MentorshipCoachRegistrationStateDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  /** The account is open and the tab is on its way out. */
  const [done, setDone] = useState(false);

  const load = useCallback(() => {
    fetchCoachRegistrationState()
      .then(setState)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const coach = isCoach(user);
  const onboarded = user ? hasCompletedOnboarding(user) : true;
  /** The ROLE, not the row: suspension revokes COACH but leaves the row with the admin's reason. */
  const editable = coach && state?.registration != null;

  useEffect(() => {
    if (!onboarded) router.replace("/onboarding");
    else if (editable) router.replace("/students/profile");
  }, [onboarded, editable, router]);

  const leave = () => router.push(coach ? "/students/profile" : "/settings");

  if (!user) return null;

  if (failed) {
    return (
      <GateNotice title={common("error_title")} body={common("error_unknown")} onBack={leave}>
        <Button
          fullWidth
          onClick={() => {
            setFailed(false);
            load();
          }}
        >
          {t("become_retry")}
        </Button>
      </GateNotice>
    );
  }

  // Held through every exit too, so no step flashes for somebody who is leaving.
  if (state === null || !onboarded || editable || done) {
    return (
      <OnboardingStepLayout progress={null}>
        <SkeletonGroup label={t("loading")} className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-[var(--play-radius)]" />
          <Skeleton className="h-48 w-full rounded-[var(--play-radius)]" />
        </SkeletonGroup>
      </OnboardingStepLayout>
    );
  }

  const backToSettings = (
    <Link href="/settings" className={LEDGE_LINK}>
      {t("become_back_settings")}
    </Link>
  );

  const standing = coach ? null : state.registration;
  if (standing !== null) {
    return (
      <GateNotice
        title={t(`become_standing_${standing.status}_title`)}
        body={t(`become_standing_${standing.status}_body`)}
        note={standing.reviewNote}
        onBack={leave}
      >
        {backToSettings}
      </GateNotice>
    );
  }

  if (!state.registrationOpen) {
    return (
      <GateNotice
        title={t("application_closed_title")}
        body={t("application_closed_body")}
        puhu
        onBack={leave}
      >
        {backToSettings}
      </GateNotice>
    );
  }

  if (state.hasCoach) {
    // ponytail: `/kocum` bounces somebody who already holds COACH, so an admin-designated coach with
    // a live link has no way through here. Give this notice its own "end the link" when that happens.
    return (
      <GateNotice
        title={t("become_has_coach_title")}
        body={t("become_has_coach_body")}
        puhu
        onBack={leave}
      >
        <Link href="/my-coach" className={LEDGE_LINK}>
          {t("become_has_coach_cta")}
        </Link>
      </GateNotice>
    );
  }

  const steps: Step[] = coach ? ["profile"] : ["change", "profile"];
  const index = Math.max(steps.indexOf(step ?? steps[0]!), 0);
  const current = steps[index]!;
  // One short of full, like onboarding: the bar completes when the account opens, not before.
  const progress = steps.length > 1 ? { done: index + 1, total: steps.length + 1 } : null;

  const go = (delta: 1 | -1) => {
    const next = steps[index + delta];
    if (!next) return leave();
    setDirection(delta);
    setStep(next);
  };

  async function finish() {
    setDone(true);
    toast.success({ title: t("registration_done_title"), message: t("registration_done_body") });
    /*
     * Pull the principal again before leaving. Registration granted COACH server-side and the
     * guard re-reads roles from the database on the next request, but the copy held in this tab
     * is the one from login, and `(coach)`'s own guard reads THAT. Navigating without this would
     * land a brand-new coach on "bu alan koçlar için".
     */
    try {
      setUserFromServer((await usersControllerMe()) as unknown as AuthUser);
    } catch {
      // The role is real regardless; the next silent refresh picks it up. Worst case the coach
      // lands on the guard and one reload fixes it, which beats staying on a stale form.
    }
    router.replace("/students/profile");
  }

  const screen =
    current === "change" ? (
      <ChangeStep progress={progress} onBack={() => go(-1)} onContinue={() => go(1)} />
    ) : (
      <CoachProfileStep
        progress={progress}
        onBack={() => go(-1)}
        onSaved={() => void finish()}
        // Nothing switches for somebody an admin already made a coach, so nothing is asked.
        saveLabel={coach ? undefined : t("become_submit")}
        beforeSave={
          coach
            ? undefined
            : () =>
                dialog.confirm({
                  title: t("become_confirm_title"),
                  message: t("become_confirm_body"),
                  confirmLabel: t("become_submit"),
                  cancelLabel: t("confirm_cancel"),
                })
        }
      />
    );

  return <OnboardingDirectionProvider value={direction}>{screen}</OnboardingDirectionProvider>;
}
