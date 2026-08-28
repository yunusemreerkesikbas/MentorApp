"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  Copy,
  MoreHorizontal,
  RefreshCw,
  X,
} from "lucide-react";
import type { StudyRoomDetailDto, StudyRoomTheme } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link, getPathname, useRouter } from "@/i18n/navigation";
import {
  closeStudyRoom,
  getStudyRoom,
  leaveStudyRoom,
  rotateStudyRoomCode,
  updateStudyRoom,
} from "@/lib/study-rooms";
import { ROOM_CURTAIN_MS } from "@/lib/study-room-theme";
import { useMentorToast } from "@/lib/mentor-toast";
import { RoomBackdropSlide } from "./room-backdrop-slide";
import { RoomSeats } from "./room-seats";
import { RoomThemeSwitcher } from "./room-theme-switcher";

/** Presence poll. Cheap because the API answers it in one indexed query. */
const REFRESH_MS = 30_000;


type State =
  | { status: "loading" }
  | { status: "error" }
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
  const reduceMotion = useReducedMotion();
  const locale = useLocale();
  const router = useRouter();
  const { error: showErrorToast, success: showSuccessToast } = useMentorToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirming, setConfirming] = useState<"leave" | "close" | null>(null);
  /** Set while the cut-to-black plays, so the CTA cannot be fired twice into one navigation. */
  const [leaving, setLeaving] = useState(false);
  /** Which way the ground travels on the next theme change — set by the arrow you pressed. */
  const [themeDirection, setThemeDirection] = useState<1 | -1>(1);

  const load = useCallback(() => {
    getStudyRoom(roomId)
      .then((room) => setState({ status: "ready", room }))
      .catch(() => setState({ status: "error" }));
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

  const run = async (action: () => Promise<unknown>, successTitle?: string) => {
    setBusy(true);
    try {
      await action();
      if (successTitle) showSuccessToast({ title: successTitle, duration: 2500 });
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
      setConfirming(null);
    }
  };

  /**
   * A link, not a bare code: pasted into a chat it works for someone who has never opened the
   * app. Built through `getPathname` so the shared URL is already in the reader's locale.
   */
  const inviteLink = (code: string) =>
    `${window.location.origin}${getPathname({ href: { pathname: "/join-room", query: { kod: code } }, locale })}`;

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      showSuccessToast({ title: t("invite_copied"), duration: 2000 });
    } catch {
      // Clipboard denied (insecure context / permission) — the code is on screen to read out.
    }
  };

  if (state.status === "loading") return null;

  if (state.status === "error") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-5 py-8">
        <BackLink label={t("back_to_session")} />
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("not_found")}
        </p>
      </main>
    );
  }

  const { room } = state;
  const isOwner = room.role === "OWNER";

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

        <RoomMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          label={t("room_menu")}
          items={[
            isOwner && room.inviteCode
              ? { key: "invite", label: t("invite_title"), onSelect: () => setInviteOpen(true) }
              : null,
            isOwner
              ? {
                  key: "close",
                  label: confirming === "close" ? t("close_confirm") : t("close_room"),
                  destructive: true,
                  onSelect: () =>
                    confirming === "close"
                      ? void run(() => closeStudyRoom(room.id)).then(
                          (ok) => ok && router.replace("/study-session"),
                        )
                      : setConfirming("close"),
                }
              : {
                  key: "leave",
                  label: confirming === "leave" ? t("leave_confirm") : t("leave"),
                  destructive: true,
                  onSelect: () =>
                    confirming === "leave"
                      ? void run(() => leaveStudyRoom(room.id)).then(
                          (ok) => ok && router.replace("/study-session"),
                        )
                      : setConfirming("leave"),
                },
          ]}
        />
      </motion.div>

      {/* --- the room --------------------------------------------------------- */}
      {/* Bottom padding reserves the pinned CTA's strip so a low seat never lands under it. */}
      <div className="relative z-0 flex flex-1 items-center justify-center px-5 pt-4 pb-28 lg:pb-32">
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
          {t("start_here")}
        </Link>
      </motion.div>

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
        <InviteSheet
          code={room.inviteCode}
          busy={busy}
          onClose={() => setInviteOpen(false)}
          onCopy={() => void copyLink(room.inviteCode!)}
          onRotate={() =>
            void run(async () => {
              const updated = await rotateStudyRoomCode(room.id);
              setState({ status: "ready", room: updated });
            }, t("invite_rotated"))
          }
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

interface MenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

/** Destructive room actions, out of the way. Closing a table should take intent, not a stray tap. */
function RoomMenu({
  open,
  onOpenChange,
  label,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  items: (MenuItem | null | false)[];
}) {
  const visible = items.filter((i): i is MenuItem => Boolean(i));
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full transition-opacity duration-200 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{ backgroundColor: "var(--room-scrim)", color: "var(--room-ink)", opacity: 0.85 }}
      >
        <MoreHorizontal className="size-5" strokeWidth={2.25} aria-hidden />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => onOpenChange(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 min-w-[12rem] overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-card-hover)]"
            style={{ backgroundColor: "var(--color-surface)" }}
          >
            {visible.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onSelect();
                  if (!item.destructive) onOpenChange(false);
                }}
                className="block min-h-11 w-full cursor-pointer px-4 text-left text-sm font-semibold transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] motion-reduce:transition-none"
                style={{ color: item.destructive ? "var(--color-danger)" : "var(--color-main)" }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Invite, on demand. It is a once-per-room job, so it does not get a permanent slot. */
function InviteSheet({
  code,
  busy,
  onClose,
  onCopy,
  onRotate,
}: {
  code: string;
  busy: boolean;
  onClose: () => void;
  onCopy: () => void;
  onRotate: () => void;
}) {
  const t = useTranslations("session_room");
  const [copied, setCopied] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t("cancel")}
        className="absolute inset-0 cursor-default"
        style={{ backgroundColor: "color-mix(in srgb, #000 45%, transparent)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("invite_title")}
        className="relative m-4 w-full max-w-md rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card-hover)]"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            className="text-base font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {t("invite_title")}
          </h2>
          <button
            type="button"
            aria-label={t("cancel")}
            onClick={onClose}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full"
            style={{ color: "var(--color-secondary)" }}
          >
            <X className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>
          {t("invite_hint")}
        </p>

        {/*
          Copy lives ON the code, not under it. A full-width primary button below made copying
          look like the dialog's main event and pushed the code — the thing you might read out
          loud to someone — into being a caption for it. One row: the code, and the icon that
          takes it.
        */}
        <div
          className="mt-4 flex items-center gap-2 rounded-[var(--radius-card)] py-2 pr-2 pl-3"
          style={{ backgroundColor: "var(--color-surface-container)" }}
        >
          <code
            className="min-w-0 flex-1 truncate text-center text-lg font-bold tracking-[0.2em]"
            style={{ color: "var(--color-main)" }}
          >
            {code}
          </code>
          <button
            type="button"
            aria-label={copied ? t("invite_copied") : t("invite_copy_link")}
            title={copied ? t("invite_copied") : t("invite_copy_link")}
            onClick={() => {
              onCopy();
              setCopied(true);
            }}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            style={{ color: copied ? "var(--color-progress)" : "var(--color-main)" }}
          >
            {copied ? (
              <Check className="size-5" strokeWidth={2.5} aria-hidden />
            ) : (
              <Copy className="size-5" strokeWidth={2.25} aria-hidden />
            )}
          </button>
        </div>

        {/*
          Rotate stays, demoted. It is the ONLY way to revoke a link that has leaked into a
          group chat, so removing it would remove the capability, not just a button — but it is
          a rare, mildly destructive action and had no business sitting at the same weight as
          copy. Now it is a labelled text button: what it does is written out, because a bare
          refresh glyph does not say "everyone's old link stops working".
        */}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setCopied(false);
            onRotate();
          }}
          className="mt-3 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-2 text-xs font-semibold transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50 motion-reduce:transition-none"
          style={{ color: "var(--color-secondary)" }}
        >
          <RefreshCw className="size-3.5" strokeWidth={2.25} aria-hidden />
          {t("invite_rotate")}
        </button>
      </div>
    </div>
  );
}
