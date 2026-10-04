"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, CircleX, LogOut, MoreHorizontal, UserPlus } from "lucide-react";
import type { StudyRoomDetailDto, StudyRoomTheme } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { LEDGE, LEDGE_FILLED, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  closeStudyRoom,
  getStudyRoom,
  leaveStudyRoom,
  updateStudyRoom,
} from "@/lib/study-rooms";
import { ROOM_CURTAIN_MS } from "@/lib/study-room-theme";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { RoomBackdropSlide } from "./room-backdrop-slide";
import { RoomInviteSheet } from "./room-invite-sheet";
import { RoomNoticeCard } from "./room-notice-card";
import { RoomSeats } from "./room-seats";
import { RoomStageSkeleton } from "./room-stage-skeleton";
import { RoomThemeSwitcher } from "./room-theme-switcher";

/** Presence poll. Cheap because the API answers it in one indexed query. */
const REFRESH_MS = 30_000;


type State =
  | { status: "loading" }
  /** `notFound`: the table is gone (or was never yours); anything else is worth retrying. */
  | { status: "error"; notFound: boolean }
  | { status: "ready"; room: StudyRoomDetailDto };

/**
 * The room, as a place rather than a card: the themed stage fills the content area and the
 * controls float over it. The app nav stays put — you can leave the table without leaving the
 * app, which is why this is not a `fixed inset-0` overlay like focus mode.
 *
 * Hierarchy is deliberate. One primary action ("sit down here"); inviting lives on the empty
 * chairs where the gap actually is; destructive actions hide in an overflow menu. The old
 * layout gave a once-per-room invite card more visual weight than the thing people came for.
 *
 * The Pomodoro is untouched — sitting down hands off to the session screen with `?room=`, so
 * there is exactly one timer implementation in the app.
 */
export function RoomShell({ roomId }: { roomId: string }) {
  const t = useTranslations("session_room");
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const dialog = useMentorDialog();
  const { error: showErrorToast } = useMentorToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  /** Set while the cut-to-black plays, so the CTA cannot be fired twice into one navigation. */
  const [leaving, setLeaving] = useState(false);
  /** Which way the ground travels on the next theme change — set by the arrow you pressed. */
  const [themeDirection, setThemeDirection] = useState<1 | -1>(1);
  /**
   * `?hosgeldin=1` comes from an invite link (`/masaya-katil`), which faded to black on the way
   * here: the lights come back up once the table is ready. One shot, so the flag leaves the
   * address as soon as it is read and a reload or a copied link lands normally.
   */
  const searchParams = useSearchParams();
  const [curtainUp, setCurtainUp] = useState(() => searchParams.get("hosgeldin") === "1");
  const welcomed = searchParams.get("hosgeldin") === "1";
  useEffect(() => {
    if (!welcomed) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("hosgeldin");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [welcomed]);

  const load = useCallback(() => {
    getStudyRoom(roomId)
      .then((room) => setState({ status: "ready", room }))
      .catch((err: unknown) =>
        setState({
          status: "error",
          notFound: err instanceof ApiClientError && (err.status === 404 || err.status === 403),
        }),
      );
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  // Silent refresh — a transient failure must not blank a table someone is sitting at.
  useEffect(() => {
    const id = setInterval(() => {
      getStudyRoom(roomId)
        .then((room) => setState({ status: "ready", room }))
        .catch(() => {});
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [roomId]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      return true;
    } catch (err) {
      showErrorToast({
        title: t("error_title"),
        message: err instanceof ApiClientError ? err.body.message : undefined,
        duration: 3000,
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Closing a table or leaving one cannot be undone from here, so it asks first, in the kit's
   * destructive confirm (red ledge, focus on "Vazgeç"). It used to relabel the menu item and
   * wait for a second tap, which one stray double-tap could satisfy.
   */
  const endMembership = async (kind: "close" | "leave", roomId: string, roomName: string) => {
    const confirmed = await dialog.confirm({
      title: t(`confirm_${kind}_title`),
      message: t(`confirm_${kind}_body`, { name: roomName }),
      confirmLabel: t(`confirm_${kind}_action`),
      cancelLabel: t("cancel"),
      destructive: true,
    });
    if (!confirmed) return;
    const ok = await run(() => (kind === "close" ? closeStudyRoom(roomId) : leaveStudyRoom(roomId)));
    if (ok) router.replace("/study-session");
  };

  const lightsUp = state.status !== "loading";
  const curtain =
    curtainUp && !reduceMotion ? (
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50"
        style={{ backgroundColor: "#000" }}
        initial={{ opacity: 1 }}
        animate={{ opacity: lightsUp ? 0 : 1 }}
        transition={{ duration: ROOM_CURTAIN_MS / 1000, ease: "easeOut" }}
        onAnimationComplete={() => {
          if (lightsUp) setCurtainUp(false);
        }}
      />
    ) : null;

  if (state.status === "loading") {
    return (
      <>
        <RoomStageSkeleton />
        {curtain}
      </>
    );
  }

  if (state.status === "error") {
    return (
      <main className={PANEL_MAIN_CLASS}>
        {state.notFound ? (
          <RoomNoticeCard puhu="encouraging" title={t("not_found_title")} body={t("not_found_body")}>
            <Link href="/study-session" className={`${LEDGE} ${LEDGE_FILLED} w-full`}>
              {t("back_to_session")}
            </Link>
          </RoomNoticeCard>
        ) : (
          <RoomNoticeCard puhu="encouraging" title={t("load_failed_title")} body={t("load_failed_body")}>
            <button
              type="button"
              onClick={() => {
                setState({ status: "loading" });
                load();
              }}
              className={`${LEDGE} ${LEDGE_FILLED} w-full`}
            >
              {t("arrive_retry")}
            </button>
            <Link href="/study-session" className="inline-flex min-h-11 items-center text-sm font-extrabold text-[var(--color-secondary)] underline-offset-4 hover:underline">
              {t("back_to_session")}
            </Link>
          </RoomNoticeCard>
        )}
        {curtain}
      </main>
    );
  }

  const { room } = state;
  const isOwner = room.role === "OWNER";
  const viewerSeated = room.seats.some((seat) => seat.userId === user?.id && seat.isSeated);

  /**
   * Right there under the name, not behind a menu: the theme is the thing about a room a
   * visitor notices first, so changing it should cost one tap, not four (menu → item → sheet →
   * arrow). Presence used to live in this same spot ("Şu an kimse çalışmıyor"); it moved out
   * because a room only has one line of chrome to spare and the seats already show who's
   * there — a glowing avatar says it better than a sentence does.
   */
  const applyTheme = (next: StudyRoomTheme, direction: 1 | -1) => {
    if (!isOwner || busy) return;
    setThemeDirection(direction);
    void run(async () => {
      const updated = await updateStudyRoom(room.id, { theme: next });
      setState({ status: "ready", room: updated });
    });
  };

  return (
    <main
      // `min-h-screen` ignored the app's own chrome, so on a phone the bottom of the room —
      // the CTA included — sat underneath the tab bar. Same viewport arithmetic the rest of
      // the app uses (see `analysis-shell`, `coach-chat-shell`).
      className="room-stage relative flex min-h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom))] flex-col overflow-hidden lg:min-h-screen"
      data-room-theme={room.theme}
    >
      <RoomBackdropSlide theme={room.theme} direction={themeDirection} />

      {/* --- floating chrome --------------------------------------------------- */}
      <motion.div
        className="relative z-20 flex items-start justify-between gap-3 px-5 pt-5 lg:px-8"
        initial={reduceMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <BackLink label={t("back_to_session")} onStage />

        <div className="min-w-0 flex-1 text-center">
          <h1
            className="truncate text-lg font-bold lg:text-xl"
            style={{
              color: "var(--room-ink)",
              fontFamily: "var(--font-heading)",
              textShadow: "0 1px 4px var(--room-ground-to)",
            }}
          >
            {room.name}
          </h1>
          {/* Theme switcher, right where the presence line used to sit. Arrows only for the
              owner — a member can see the theme but not change it, same as the old menu item.
              Shared with the seated session screen, which now shows the same control. */}
          <div className="mt-0.5">
            <RoomThemeSwitcher
              theme={room.theme}
              canChange={isOwner}
              busy={busy}
              onChange={applyTheme}
            />
          </div>
        </div>

        {/* Destructive room actions, out of the way. The app's own menu, portalled to the
            body: rendered on the stage, its white panel inherited the room's cream ink. */}
        <PopoverMenu
          align="right"
          menuClassName="min-w-[13.5rem] py-1.5"
          trigger={({ open, setOpen, menuId }) => (
            <button
              type="button"
              aria-label={t("room_menu")}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={open ? menuId : undefined}
              onClick={() => setOpen(!open)}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full transition-opacity duration-200 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--room-ink)] motion-reduce:transition-none"
              style={{ backgroundColor: "var(--room-scrim)", color: "var(--room-ink)", opacity: 0.85 }}
            >
              <MoreHorizontal className="size-5" strokeWidth={2.25} aria-hidden />
            </button>
          )}
        >
          {isOwner && room.inviteCode ? (
            <PopoverMenuItem onClick={() => setInviteOpen(true)}>
              <span className="flex items-center gap-2.5">
                <UserPlus className="size-[22px]" strokeWidth={1.75} aria-hidden />
                {t("invite_title")}
              </span>
            </PopoverMenuItem>
          ) : null}
          <PopoverMenuItem
            danger
            onClick={() => void endMembership(isOwner ? "close" : "leave", room.id, room.name)}
          >
            <span className="flex items-center gap-2.5">
              {isOwner ? (
                <CircleX className="size-[22px]" strokeWidth={1.75} aria-hidden />
              ) : (
                <LogOut className="size-[22px]" strokeWidth={1.75} aria-hidden />
              )}
              {isOwner ? t("close_room") : t("leave")}
            </span>
          </PopoverMenuItem>
        </PopoverMenu>
      </motion.div>

      {/* --- the room --------------------------------------------------------- */}
      {/* Bottom padding reserves the pinned CTA's strip so a low seat never lands under it. */}
      <div className="relative z-0 flex min-h-0 flex-1 items-center justify-center px-5 pt-4 pb-28 lg:pb-32">
        <RoomSeats
          seats={room.seats}
          capacity={room.capacity}
          theme={room.theme}
          onInvite={isOwner && room.inviteCode ? () => setInviteOpen(true) : undefined}
        />
      </div>

      {/* --- one primary action ------------------------------------------------ */}
      <motion.div
        // Pinned, not in flow: the room is a place you look around, and the one way out of it
        // has to stay put while you do. In flow it drifted with the stage's height and, on a
        // phone, fell off the bottom entirely.
        className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-5 pb-6 lg:pb-10"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.1, ease: "easeOut" }}
      >
        {/*
          A link that waits for the lights to go down. Sitting down is a change of scene, not a
          page load: hard-cutting from a lit room to the timer screen read as being ejected.
          Still a real `<a>` — middle-click, ctrl-click and "open in new tab" go straight
          through (`defaultPrevented` is never touched for those), and `prefers-reduced-motion`
          skips the fade entirely rather than sitting on a black screen for no reason.
        */}
        <Link
          href={{ pathname: "/study-session", query: { room: room.id } }}
          onClick={(e) => {
            if (reduceMotion || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            if (leaving) return;
            setLeaving(true);
            window.setTimeout(
              () => router.push({ pathname: "/study-session", query: { room: room.id } }),
              ROOM_CURTAIN_MS,
            );
          }}
          className="flex min-h-[3.25rem] w-full max-w-sm items-center justify-center rounded-full px-6 text-base font-bold shadow-[var(--shadow-card)] transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--room-ink)] motion-reduce:transition-none motion-reduce:hover:scale-100"
          style={{ backgroundColor: "var(--room-cta)", color: "var(--room-cta-ink)" }}
        >
          {t(viewerSeated ? "seated_here" : "start_here")}
        </Link>
      </motion.div>

      {curtain}

      {/* The curtain. `z-50` clears the invite sheet; nothing on the stage should outlive it. */}
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

      {inviteOpen && room.inviteCode ? (
        <RoomInviteSheet
          room={room}
          code={room.inviteCode}
          onClose={() => setInviteOpen(false)}
          onRotated={(updated) => setState({ status: "ready", room: updated })}
        />
      ) : null}
    </main>
  );
}

function BackLink({ label, onStage }: { label: string; onStage?: boolean }) {
  return (
    <Link
      href="/study-session"
      aria-label={label}
      title={label}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-opacity duration-200 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      style={
        onStage
          ? {
              backgroundColor: "var(--room-scrim)",
              color: "var(--room-ink)",
              opacity: 0.85,
            }
          : { color: "var(--color-secondary)" }
      }
    >
      <ArrowLeft className="size-5" strokeWidth={2.25} aria-hidden />
    </Link>
  );
}
