"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Copy, RefreshCw } from "lucide-react";
import type { StudyRoomDetailDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card } from "@mentor/ui";
import { useLocale } from "next-intl";
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

/** Presence poll. Matches the room list; cheap because the API answers it in one indexed query. */
const REFRESH_MS = 30_000;

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; room: StudyRoomDetailDto };

/**
 * The shared table: the themed ground, the seats around it with live "who is focusing" state,
 * and the owner's invite code.
 *
 * The Pomodoro itself is untouched — starting work at the table hands off to the session screen
 * with `?room=`, so there is exactly one timer implementation in the app.
 */
export function RoomShell({ roomId }: { roomId: string }) {
  const t = useTranslations("session_room");
  const locale = useLocale();
  const router = useRouter();
  const { error: showErrorToast, success: showSuccessToast } = useMentorToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
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
   * app (sign-up happens on the way, and they land at this table afterwards). Built through
   * `getPathname` so the shared URL is already in the reader's locale.
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

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-5 py-6 lg:py-10">
      <BackLink label={t("back_to_session")} />

      <header className="flex flex-col gap-1">
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {room.name}
        </h1>
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("theme_" + room.theme)} ·{" "}
          {t("seats", { filled: room.memberCount, capacity: room.capacity })}
        </p>
      </header>

      {/* The room itself: themed ground, with the table and its seats laid over it in DOM. */}
      <div
        className="relative overflow-hidden rounded-[var(--radius-card)]"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <RoomBackdrop theme={room.theme} />
        <div className="relative px-4 py-5">
          <RoomSeats seats={room.seats} capacity={room.capacity} theme={room.theme} />
          <p
            className="mt-2 text-center text-sm font-semibold"
            style={{ color: "var(--color-secondary)" }}
          >
            {room.activeCount > 0
              ? t("working_count", { count: room.activeCount })
              : t("nobody_working")}
          </p>
        </div>
      </div>

      <Link
        href={{ pathname: "/study-session", query: { room: room.id } }}
        className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-card)] text-sm font-semibold"
        style={{ backgroundColor: "var(--color-progress)", color: "var(--color-bg)" }}
      >
        {t("start_here")}
      </Link>

      {isOwner && room.inviteCode ? (
        <Card className="flex flex-col gap-3 px-4 py-4">
          <span
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("invite_title")}
          </span>
          <div className="flex items-center gap-2">
            <code
              className="min-w-0 flex-1 truncate rounded-[var(--radius-card)] px-3 py-2 text-sm font-bold tracking-wider"
              style={{
                backgroundColor: "var(--color-surface-container)",
                color: "var(--color-main)",
              }}
            >
              {room.inviteCode}
            </code>
            <IconAction
              label={t("invite_copy_link")}
              onClick={() => void copyLink(room.inviteCode!)}
              icon={<Copy className="size-4" strokeWidth={2.25} aria-hidden />}
            />
            <IconAction
              label={t("invite_rotate")}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const updated = await rotateStudyRoomCode(room.id);
                  setState({ status: "ready", room: updated });
                }, t("invite_rotated"))
              }
              icon={<RefreshCw className="size-4" strokeWidth={2.25} aria-hidden />}
            />
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-secondary)" }}>
            {t("invite_hint")}
          </p>
        </Card>
      ) : null}

      <div className="flex justify-center">
        {isOwner ? (
          confirming === "close" ? (
            <TextAction
              label={t("close_confirm")}
              tone="accent"
              disabled={busy}
              onClick={() =>
                void run(() => closeStudyRoom(room.id)).then(
                  (ok) => ok && router.replace("/study-session"),
                )
              }
            />
          ) : (
            <TextAction label={t("close_room")} onClick={() => setConfirming("close")} />
          )
        ) : confirming === "leave" ? (
          <TextAction
            label={t("leave_confirm")}
            tone="accent"
            disabled={busy}
            onClick={() =>
              void run(() => leaveStudyRoom(room.id)).then(
                (ok) => ok && router.replace("/study-session"),
              )
            }
          />
        ) : (
          <TextAction label={t("leave")} onClick={() => setConfirming("leave")} />
        )}
      </div>
    </main>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/study-session"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold"
      style={{ color: "var(--color-secondary)" }}
    >
      <ArrowLeft className="size-4" strokeWidth={2.25} aria-hidden />
      {label}
    </Link>
  );
}

function IconAction({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] disabled:opacity-50"
      style={{ backgroundColor: "var(--color-surface-container)", color: "var(--color-main)" }}
    >
      {icon}
    </button>
  );
}

function TextAction({
  label,
  onClick,
  tone = "quiet",
  disabled,
}: {
  label: string;
  onClick: () => void;
  tone?: "accent" | "quiet";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-11 cursor-pointer text-sm font-semibold disabled:opacity-50"
      style={{ color: tone === "accent" ? "var(--color-progress)" : "var(--color-secondary)" }}
    >
      {label}
    </button>
  );
}
