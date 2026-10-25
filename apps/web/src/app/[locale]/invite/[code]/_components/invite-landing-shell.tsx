"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { inviteCodeSchema } from "@mentor/validation";
import { useAuth } from "@/lib/auth-context";
import { COACH_HOME, isCoach } from "@/lib/coach-surface";
import { consumePendingReferral } from "@/lib/pending-referral";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";
import { InviteAccept } from "./invite-accept";
import { InviteLandingFrame } from "./invite-landing-frame";
import { InviteLandingSkeleton } from "./invite-landing-skeleton";
import { InviteNotice, type InviteNoticeExit } from "./invite-notice";
import { InviteWelcome } from "./invite-welcome";
import { useInvitePreview } from "./use-invite-preview";

/** The canonical code for what the URL carries, or null when it is not an invite code at all. */
function readCode(raw: string): string | null {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // A stray "%" stays as it is and fails the schema below.
  }
  const parsed = inviteCodeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The notice's way out: signup for a visitor, the person's own home for someone signed in. */
function exitFor(signedIn: boolean, coach: boolean, onboarded: boolean): InviteNoticeExit {
  if (!signedIn) return { href: "/signup", label: "invalid_cta" };
  if (coach) return { href: COACH_HOME, label: "go_panel" };
  return onboarded
    ? { href: "/dashboard", label: "go_panel" }
    : { href: "/onboarding", label: "invalid_cta" };
}

/**
 * `/davet/PUHU-XXXXXXXX`, for a friend following a shared link. Fetches the public preview and
 * picks one of four cards:
 *
 * - signed-in, onboarded student: one button to accept (nothing is redeemed by arriving);
 * - anyone else who can use the link (a visitor, or a student mid-onboarding): the welcome, whose
 *   buttons remember the code for the redeem that follows onboarding;
 * - a coach, a dead link or a malformed code: the neutral notice, with nothing to redeem;
 * - a failed lookup: the same notice with a retry.
 *
 * The skeleton holds the card's place until both the session and the preview are known.
 */
export function InviteLandingShell({ code: rawCode }: { code: string }) {
  const { status, user } = useAuth();
  const code = useMemo(() => readCode(rawCode), [rawCode]);
  const { state, retry } = useInvitePreview(code, status !== "loading");

  const signedIn = status === "authenticated";
  const coach = isCoach(user);
  const onboarded = user ? hasCompletedOnboarding(user) : false;
  const canAccept = signedIn && onboarded && !coach;

  // An onboarded student chooses on this page, so a code remembered by an earlier button press
  // (sign in, come back) has done its job and must not redeem again at some later onboarding.
  useEffect(() => {
    if (canAccept) consumePendingReferral();
  }, [canAccept]);

  let card: ReactNode;
  if (status === "loading" || state.phase === "loading") {
    card = <InviteLandingSkeleton />;
  } else if (state.phase === "failed") {
    card = <InviteNotice kind="failed" exit={exitFor(signedIn, coach, onboarded)} onRetry={retry} />;
  } else if (state.phase === "invalid" || !code || coach) {
    card = <InviteNotice kind="invalid" exit={exitFor(signedIn, coach, onboarded)} onRetry={retry} />;
  } else if (canAccept) {
    card = <InviteAccept code={code} preview={state.preview} />;
  } else {
    card = <InviteWelcome code={code} preview={state.preview} signedIn={signedIn} />;
  }

  return <InviteLandingFrame>{card}</InviteLandingFrame>;
}
