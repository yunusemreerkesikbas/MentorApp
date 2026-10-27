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
import { InviteStanding } from "./invite-standing";
import { InviteWelcome } from "./invite-welcome";
import { useInvitePreview } from "./use-invite-preview";
import { useOwnInvite } from "./use-own-invite";

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
 * picks one of these cards:
 *
 * - signed-in, onboarded student who can still use an invite: one button to accept (nothing is
 *   redeemed by arriving). Their own invite view decides this: one who already came with an
 *   invite, or can no longer use one (paid, or past the signup window), gets the calm standing
 *   card with no button and no discount. One on a trial can still accept, without the discount
 *   line (checkout would not apply it). If that lookup fails, the accept card without the
 *   discount line: never a promise on unknown state;
 * - anyone else who can use the link (a visitor, or a student mid-onboarding): the welcome, whose
 *   buttons remember the code for the redeem that follows onboarding;
 * - a coach, a dead link or a malformed code: the neutral notice, with nothing to redeem;
 * - a failed lookup: the same notice with a retry.
 *
 * The skeleton holds the card's place until the session, the preview and (for an onboarded
 * student) their own invite view are known.
 */
export function InviteLandingShell({ code: rawCode }: { code: string }) {
  const { status, user } = useAuth();
  const code = useMemo(() => readCode(rawCode), [rawCode]);
  const { state, retry } = useInvitePreview(code, status !== "loading");

  const signedIn = status === "authenticated";
  const coach = isCoach(user);
  const onboarded = user ? hasCompletedOnboarding(user) : false;
  const canAccept = signedIn && onboarded && !coach;
  const own = useOwnInvite(canAccept && code !== null);

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
    if (own.phase === "loading") {
      card = <InviteLandingSkeleton />;
    } else if (own.phase === "ready" && own.view.redeemed) {
      card = <InviteStanding redeemedBy={own.view.redeemed.inviterDisplayName} />;
    } else if (own.phase === "ready" && !own.view.canRedeem) {
      card = <InviteStanding redeemedBy={null} />;
    } else {
      // A failed lookup still lets them accept (the API judges the redeem), but promises nothing.
      // A trial (open subscription) may redeem too, but checkout would not apply the discount.
      const honest = own.phase === "ready" && !own.view.checkoutBlocked;
      const preview = honest ? state.preview : { ...state.preview, discount: null };
      card = <InviteAccept code={code} preview={preview} />;
    }
  } else {
    card = <InviteWelcome code={code} preview={state.preview} signedIn={signedIn} />;
  }

  return <InviteLandingFrame>{card}</InviteLandingFrame>;
}
