"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, RefreshCw, Share } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { StudyRoomDetailDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import { getPathname } from "@/i18n/navigation";
import { rotateStudyRoomCode } from "@/lib/study-rooms";
import { RoomSheet } from "./room-sheet";

/**
 * Invite, on demand: the code to read out, the link to paste or hand to the phone's share
 * sheet, and the one way to revoke a link that leaked. A once-per-room job, so it gets no
 * permanent slot on the table.
 *
 * Every answer stays inside the sheet (a copy, a new code, a failure). The toast and confirm
 * layers live under the native dialog's top layer, where they would be dimmed and inert, so
 * "Kodu yenile" asks its question in place instead of stacking a second dialog.
 */
export function RoomInviteSheet({
  room,
  code,
  onClose,
  onRotated,
}: {
  room: StudyRoomDetailDto;
  code: string;
  onClose: () => void;
  onRotated: (room: StudyRoomDetailDto) => void;
}) {
  const t = useTranslations("session_room");
  const locale = useLocale();
  const askTitleId = useId();
  const askTitleRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    if (asking) askTitleRef.current?.focus();
  }, [asking]);

  // A link, not a bare code: pasted into a chat it works for someone who has never opened the
  // app. Built through `getPathname` so the shared URL is already in the reader's locale.
  const link = `${window.location.origin}${getPathname({ href: { pathname: "/join-room", query: { kod: code } }, locale })}`;
  const canShare = typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setStatus({ error: false, text: t("invite_link_copied") });
    } catch {
      // Clipboard denied (insecure context / permission): the code is on screen to read out.
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: room.name, text: t("invite_share_text", { name: room.name }), url: link });
    } catch {
      // A dismissed share sheet needs no answer.
    }
  };

  const rotate = async () => {
    setRotating(true);
    try {
      onRotated(await rotateStudyRoomCode(room.id));
      setAsking(false);
      setCopied(false);
      setStatus({ error: false, text: t("invite_rotated") });
    } catch (err) {
      setStatus({
        error: true,
        text: err instanceof ApiClientError ? err.body.message : t("error_title"),
      });
    } finally {
      setRotating(false);
    }
  };

  return (
    <RoomSheet open onClose={onClose} title={t("invite_title")} closeDisabled={rotating}>
      <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("invite_hint")}</p>

      <div className="flex flex-col gap-1.5">
        {/* Copy lives ON the code: the code is what you might read out loud, not a caption. */}
        <div className="flex min-h-16 items-center gap-1.5 rounded-[var(--radius-card)] bg-[var(--color-surface-container)] py-2 pl-4 pr-1.5">
          <code className="min-w-0 flex-1 truncate text-center font-mono text-xl font-extrabold tracking-normal text-[var(--color-main)]">
            {code}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={copied ? t("invite_link_copied") : t("invite_copy_link")}
            title={copied ? t("invite_link_copied") : t("invite_copy_link")}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-[var(--color-main)] transition-colors duration-150 hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          >
            {copied ? (
              <Check className="size-[22px]" strokeWidth={1.75} aria-hidden />
            ) : (
              <Copy className="size-[22px]" strokeWidth={1.75} aria-hidden />
            )}
          </button>
        </div>
        <p
          role="status"
          className={`min-h-5 text-caption font-semibold ${status?.error ? "text-[var(--color-danger)]" : "text-[var(--color-secondary)]"}`}
        >
          {status?.text}
        </p>
      </div>

      {canShare ? (
        <Button fullWidth onClick={() => void share()}>
          <Share className="size-[22px]" strokeWidth={1.75} aria-hidden />
          {t("invite_share")}
        </Button>
      ) : null}

      {asking ? (
        <div
          role="group"
          aria-labelledby={askTitleId}
          className="flex flex-col gap-1.5 rounded-[var(--radius-card)] bg-[var(--color-surface-container)] p-4"
        >
          <p
            id={askTitleId}
            ref={askTitleRef}
            tabIndex={-1}
            className="text-base font-extrabold text-[var(--color-main)] outline-none"
          >
            {t("confirm_rotate_title")}
          </p>
          <p className="text-body-sm font-semibold text-[var(--color-secondary)]">
            {t("confirm_rotate_body")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-[18px] gap-y-2">
            <Button size="sm" variant="secondary" busy={rotating} onClick={() => void rotate()}>
              {t("confirm_rotate_action")}
            </Button>
            <button
              type="button"
              disabled={rotating}
              onClick={() => setAsking(false)}
              className={PANEL_QUIET_LINK}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        // Rotating is the ONLY way to revoke a link that leaked into a group chat, so it stays;
        // it is rare and cuts everyone's old link, so it asks first and never outranks sharing.
        <button type="button" onClick={() => setAsking(true)} className={`${PANEL_QUIET_LINK} self-center`}>
          <RefreshCw className="size-[18px]" strokeWidth={1.75} aria-hidden />
          {t("invite_rotate")}
        </button>
      )}
    </RoomSheet>
  );
}
