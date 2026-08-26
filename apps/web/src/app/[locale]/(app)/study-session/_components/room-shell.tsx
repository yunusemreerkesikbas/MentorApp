"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Check, Copy, MoreHorizontal, RefreshCw, X } from "lucide-react";
import type { StudyRoomDetailDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link, getPathname, useRouter } from "@/i18n/navigation";
import {
  closeStudyRoom,
  getStudyRoom,
  leaveStudyRoom,
  rotateStudyRoomCode,
} from "@/lib/study-rooms";
import { useMentorToast } from "@/lib/mentor-toast";
import { RoomBackdrop } from "./room-backdrop";
import { RoomSeats } from "./room-seats";

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
  const locale = useLocale();
  const router = useRouter();
  const { error: showErrorToast, success: showSuccessToast } = useMentorToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirming, setConfirming] = useState<"leave" | "close" | null>(null);

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
  const seatedSubjects = room.seats
    .filter((s) => s.isSeated && s.subject)
    .map((s) => s.subject!)
    .slice(0, 3);

  return (
    <main
      className="room-stage relative flex min-h-screen flex-col overflow-hidden"
      data-room-theme={room.theme}
    >
      <RoomBackdrop theme={room.theme} />

      {/* --- floating chrome --------------------------------------------------- */}
      <div className="relative z-10 flex items-start justify-between gap-3 px-5 pt-5 lg:px-8">
        <BackLink label={t("back_to_session")} onStage />

        <div className="min-w-0 flex-1 text-center">
          <h1
            className="truncate text-lg font-bold lg:text-xl"
            style={{ color: "var(--room-ink)", fontFamily: "var(--font-heading)" }}
          >
            {room.name}
          </h1>
          {/* Live status as the subtitle — presence is the reason to be here, not a footnote. */}
          <p
            className="mt-0.5 flex items-center justify-center gap-1.5 text-sm"
            style={{ color: "var(--room-ink-soft)" }}
          >
            {room.activeCount > 0 ? (
              <>
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: "var(--room-accent)" }}
                />
                <span className="truncate font-semibold" style={{ color: "var(--room-ink)" }}>
                  {t("working_count", { count: room.activeCount })}
                </span>
                {seatedSubjects.length > 0 ? (
                  <span className="hidden truncate sm:inline">· {seatedSubjects.join(", ")}</span>
                ) : null}
              </>
            ) : (
              <span className="truncate">{t("nobody_working")}</span>
            )}
          </p>
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
      </div>

      {/* --- the room --------------------------------------------------------- */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-4">
        <RoomSeats
          seats={room.seats}
          capacity={room.capacity}
          onInvite={isOwner && room.inviteCode ? () => setInviteOpen(true) : undefined}
        />
      </div>

      {/* --- one primary action ------------------------------------------------ */}
      <div className="relative z-10 flex justify-center px-5 pb-8 lg:pb-10">
        <Link
          href={{ pathname: "/study-session", query: { room: room.id } }}
          className="flex min-h-[3.25rem] w-full max-w-sm items-center justify-center rounded-full px-6 text-base font-bold shadow-[var(--shadow-card)] transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--room-accent)] motion-reduce:transition-none motion-reduce:hover:scale-100"
          style={{ backgroundColor: "var(--room-accent)", color: "var(--room-ground-to)" }}
        >
          {t("start_here")}
        </Link>
      </div>

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
            className="fixed inset-0 z-10 cursor-default"
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

        <code
          className="mt-4 block truncate rounded-[var(--radius-card)] px-3 py-3 text-center text-lg font-bold tracking-[0.2em]"
          style={{ backgroundColor: "var(--color-surface-container)", color: "var(--color-main)" }}
        >
          {code}
        </code>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onCopy();
              setCopied(true);
            }}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-card)] text-sm font-bold"
            style={{ backgroundColor: "var(--color-progress)", color: "var(--color-bg)" }}
          >
            {copied ? (
              <Check className="size-4" strokeWidth={2.5} aria-hidden />
            ) : (
              <Copy className="size-4" strokeWidth={2.25} aria-hidden />
            )}
            {copied ? t("invite_copied") : t("invite_copy_link")}
          </button>
          <button
            type="button"
            aria-label={t("invite_rotate")}
            title={t("invite_rotate")}
            disabled={busy}
            onClick={() => {
              setCopied(false);
              onRotate();
            }}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] disabled:opacity-50"
            style={{ backgroundColor: "var(--color-surface-container)", color: "var(--color-main)" }}
          >
            <RefreshCw className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
