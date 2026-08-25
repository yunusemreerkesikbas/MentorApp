"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { rememberPendingInvite } from "@/lib/pending-invite";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";
import { joinStudyRoom } from "@/lib/study-rooms";

/** The `?kod=` value a shared link carries. English `code` is accepted too, for the EN route. */
function readCode(params: URLSearchParams): string | null {
  const raw = params.get("kod") ?? params.get("code");
  const value = raw?.trim().toUpperCase();
  return value ? value : null;
}

type FailureReason = "no_code" | "already_member" | "invalid" | "error";

/**
 * Redeems an invite link. Four paths, and the last one is the reason this page exists:
 * signed-in and onboarded → join and land at the table; signed in mid-onboarding → park the
 * invite and finish onboarding first; anonymous → park the invite and go sign up, arriving at
 * the table afterwards. Failures explain themselves rather than dumping the user on a 404.
 */
export function RoomJoinShell() {
  const t = useTranslations("session_room");
  const params = useSearchParams();
  const router = useRouter();
  const { status, user } = useAuth();
  // Only async outcomes need state; a missing code is knowable at render time, so it is
  // derived rather than written from the effect.
  const [asyncFailure, setAsyncFailure] = useState<FailureReason | null>(null);
  // Redeem once per code, not once per render: the effect re-runs whenever the auth or router
  // identity changes. Keyed by the code (rather than a plain boolean) so React's development
  // remount still lands its result on the live instance instead of a discarded one.
  const attemptedRef = useRef<string | null>(null);

  const code = readCode(params);

  useEffect(() => {
    if (status === "loading" || !code) return;
    if (attemptedRef.current === code) return;
    attemptedRef.current = code;

    // Set by cleanup: a result arriving after unmount must not update a dead instance.
    let active = true;
    const invitePath = `/join-room?kod=${encodeURIComponent(code)}`;

    if (status === "anonymous") {
      rememberPendingInvite(invitePath);
      router.replace({ pathname: "/signup", query: { next: invitePath } });
      return;
    }
    if (!user || !hasCompletedOnboarding(user)) {
      rememberPendingInvite(invitePath);
      router.replace("/onboarding");
      return;
    }

    joinStudyRoom(code)
      .then((room) =>
        router.replace({ pathname: "/study-session/rooms/[id]", params: { id: room.id } }),
      )
      .catch((err: unknown) => {
        if (!active) return;
        const apiCode = err instanceof ApiClientError ? err.body.code : null;
        setAsyncFailure(
          apiCode === "COACHING_ROOM_ALREADY_MEMBER"
            ? "already_member"
            : apiCode === "COACHING_ROOM_CODE_INVALID" || apiCode === "COACHING_ROOM_NOT_FOUND"
              ? "invalid"
              : "error",
        );
      });

    return () => {
      active = false;
    };
  }, [code, status, user, router]);

  const failure: FailureReason | null = code ? asyncFailure : "no_code";

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {failure === null ? (
        <p style={{ color: "var(--color-secondary)" }}>{t("joining")}</p>
      ) : (
        <>
          <p
            className="text-base font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {t(`join_failed_${failure}`)}
          </p>
          <Link
            href="/study-session"
            className="min-h-11 rounded-[var(--radius-card)] px-4 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: "var(--color-progress)", color: "var(--color-bg)" }}
          >
            {t("back_to_session")}
          </Link>
        </>
      )}
    </main>
  );
}
