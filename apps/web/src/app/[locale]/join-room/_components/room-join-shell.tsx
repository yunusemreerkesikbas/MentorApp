"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LEDGE, LEDGE_FILLED, PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { rememberPendingInvite } from "@/lib/pending-invite";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";
import { ROOM_CURTAIN_MS } from "@/lib/study-room-theme";
import { joinStudyRoom, studyRoomJoinFailure, type StudyRoomJoinFailure } from "@/lib/study-rooms";
import { RoomNoticeCard } from "../../(app)/study-session/_components/room-notice-card";

/** The `?kod=` value a shared link carries. English `code` is accepted too, for the EN route. */
function readCode(params: URLSearchParams): string | null {
  const raw = params.get("kod") ?? params.get("code");
  const value = raw?.trim().toUpperCase();
  return value ? value : null;
}

type FailureReason = "no_code" | StudyRoomJoinFailure;

/**
 * Redeems an invite link. Four paths, and the last one is the reason this page exists:
 * signed-in and onboarded → join and land at the table; signed in mid-onboarding → park the
 * invite and finish onboarding first; anonymous → park the invite and go sign up, arriving at
 * the table afterwards. Failures explain themselves rather than dumping the user on a 404.
 *
 * The page is the table's front door: a card with Puhu while the seat is taken, a cut to black
 * on success (the room lifts it, `?hosgeldin=1`), and for every failure one sentence and the
 * next step: enter the code by hand, go to your tables, or try again.
 */
export function RoomJoinShell() {
  const t = useTranslations("session_room");
  const params = useSearchParams();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { status, user } = useAuth();
  // Only async outcomes need state; a missing code is knowable at render time, so it is
  // derived rather than written from the effect.
  const [asyncFailure, setAsyncFailure] = useState<FailureReason | null>(null);
  /** Bumped by "Yeniden dene": a new attempt for the same code. */
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  // Redeem once per code and attempt, not once per render: the effect re-runs whenever the auth
  // or router identity changes. Keyed (rather than a plain boolean) so React's development
  // remount still lands its result on the live instance instead of a discarded one.
  const attemptedRef = useRef<string | null>(null);

  const code = readCode(params);

  useEffect(() => {
    if (status === "loading" || !code) return;
    const key = `${code}#${attempt}`;
    if (attemptedRef.current === key) return;
    attemptedRef.current = key;

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
      .then((room) => {
        const arrive = () =>
          router.replace({
            pathname: "/study-session/rooms/[id]",
            params: { id: room.id },
            query: { hosgeldin: "1" },
          });
        if (reduceMotion) {
          arrive();
          return;
        }
        if (active) setLeaving(true);
        window.setTimeout(arrive, ROOM_CURTAIN_MS);
      })
      .catch((err: unknown) => {
        if (active) setAsyncFailure(studyRoomJoinFailure(err));
      });

    return () => {
      active = false;
    };
  }, [code, status, user, router, attempt, reduceMotion]);

  const failure: FailureReason | null = code ? asyncFailure : "no_code";

  const backLink = (
    <Link href="/study-session" className={PANEL_QUIET_LINK}>
      {t("back_to_session")}
    </Link>
  );
  const enterCode = (
    <Link
      href={{ pathname: "/study-session", query: { katil: "1" } }}
      className={`${LEDGE} ${LEDGE_FILLED} w-full`}
    >
      {t("arrive_enter_code")}
    </Link>
  );

  return (
    <main
      className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 pb-10 pt-16"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* The app's pastel atmosphere (DESIGN.md §2.2): this page sits outside the app shell and is
          often the very first screen someone sees, so it carries the look on its own. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 left-1/4 h-[32rem] w-[32rem] rounded-full blur-[150px]"
          style={{ backgroundColor: "var(--blob-blue)", opacity: "var(--blob-blue-opacity)" }}
        />
        <div
          className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full blur-[150px]"
          style={{ backgroundColor: "var(--blob-cyan)", opacity: "var(--blob-cyan-opacity)" }}
        />
        <div
          className="absolute -bottom-24 -left-24 h-[24rem] w-[24rem] rounded-full blur-[150px]"
          style={{ backgroundColor: "var(--blob-pink)", opacity: "var(--blob-pink-opacity)" }}
        />
      </div>
      <p aria-hidden className="absolute left-5 top-6 text-xl font-black tracking-[-0.01em] text-[var(--color-main)] lg:left-10 lg:top-8">
        Mentor
      </p>

      {failure === null ? (
        <RoomNoticeCard puhu="happy" title={t("arrive_joining_title")}>
          {code ? (
            <span className="rounded-full bg-[var(--color-surface-container)] px-3 py-1.5 font-mono text-caption font-bold tracking-[0.06em] text-[var(--color-main)]">
              {code}
            </span>
          ) : null}
          <div
            role="progressbar"
            aria-label={t("joining")}
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--play-track)]"
          >
            <span className="block h-full w-2/5 animate-[room-join-progress_1.2s_ease-in-out_infinite] rounded-full bg-[var(--play-cta)] motion-reduce:w-full motion-reduce:animate-none" />
          </div>
        </RoomNoticeCard>
      ) : failure === "already_member" ? (
        <RoomNoticeCard
          puhu="default"
          title={t("arrive_already_member_title")}
          body={t("arrive_already_member_body")}
        >
          <Link href="/study-session" className={`${LEDGE} ${LEDGE_FILLED} w-full`}>
            {t("arrive_my_tables")}
          </Link>
        </RoomNoticeCard>
      ) : failure === "error" ? (
        <RoomNoticeCard puhu="encouraging" title={t("arrive_error_title")} body={t("arrive_error_body")}>
          <button
            type="button"
            onClick={() => {
              setAsyncFailure(null);
              setAttempt((n) => n + 1);
            }}
            className={`${LEDGE} ${LEDGE_FILLED} w-full`}
          >
            {t("arrive_retry")}
          </button>
          {backLink}
        </RoomNoticeCard>
      ) : (
        <RoomNoticeCard
          puhu="encouraging"
          title={t(`arrive_${failure}_title`)}
          body={t(`arrive_${failure}_body`)}
        >
          {enterCode}
          {backLink}
        </RoomNoticeCard>
      )}

      {/* The cut to black on the way in; the room lifts it. */}
      {leaving ? (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50"
          style={{ backgroundColor: "#000" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: ROOM_CURTAIN_MS / 1000, ease: "easeIn" }}
        />
      ) : null}
    </main>
  );
}
