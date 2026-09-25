"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiClientError, usersControllerResendVerificationEmail } from "@mentor/api-client";
import type { MentorshipInviteCodeDto } from "@mentor/types";
import { getPathname } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { rotateInviteCode } from "@/lib/mentorship";
import type { InviteLock } from "./invite-lock";

/**
 * Everything a coach can do with their invite code, shared by the seat card in the rail and the
 * round's invitation when there are no students yet.
 *
 * - The link is what a coach sends; `?code=` only fills the field in, the student still reviews
 *   the data scope and confirms, because clicking a link somebody sent is not consent.
 * - Copying always sends the real code; masking hides it from the room, not from the clipboard.
 * - Rotation asks first when a code exists: it kills every copy already in a student's hands.
 *   Creating the first one invalidates nothing, so that press goes straight through.
 * - EMAIL is the one lock the coach can clear, so pressing create asks to send the verification.
 */
export function useInviteActions({
  inviteCode,
  inviteLock,
  onCode,
}: {
  inviteCode: MentorshipInviteCodeDto | null;
  inviteLock: InviteLock;
  onCode: (code: MentorshipInviteCodeDto) => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const { success: toastSuccess, error: toastError } = useMentorToast();
  const dialog = useMentorDialog();
  const [busy, setBusy] = useState(false);

  async function copy(text: string, title: string) {
    try {
      await navigator.clipboard.writeText(text);
      toastSuccess({ title });
    } catch {
      /* Clipboard can be blocked; revealing the code is the way back to it either way. */
    }
  }

  async function copyLink() {
    if (!inviteCode) return;
    const path = getPathname({ href: "/coach-invitation", locale });
    await copy(
      `${window.location.origin}${path}?code=${encodeURIComponent(inviteCode.code)}`,
      t("invite_link_copied"),
    );
  }

  async function copyCode() {
    if (inviteCode) await copy(inviteCode.code, t("invite_copied"));
  }

  async function verifyEmail() {
    const confirmed = await dialog.confirm({
      title: t("invite_email_verify_title"),
      message: t("invite_email_verify_message"),
      confirmLabel: t("invite_email_verify_confirm"),
      cancelLabel: t("confirm_cancel"),
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await usersControllerResendVerificationEmail();
      await dialog.info({
        title: t("invite_email_verify_sent_title"),
        message: t("invite_email_verify_sent_message"),
        okLabel: t("invite_email_verify_sent_ok"),
        closeLabel: t("invite_email_verify_sent_ok"),
      });
    } catch (err) {
      toastError({
        title: t("invite_email_verify_send_error_title"),
        message:
          err instanceof ApiClientError ? err.message : t("invite_email_verify_send_error_message"),
      });
    } finally {
      setBusy(false);
    }
  }

  /** Creates the first code, or replaces the current one after the coach confirms. */
  async function rotate() {
    if (inviteLock === "EMAIL") {
      await verifyEmail();
      return;
    }
    if (inviteCode !== null) {
      const confirmed = await dialog.confirm({
        title: t("invite_rotate_confirm_title"),
        message: t("invite_rotate_warning"),
        confirmLabel: t("invite_rotate_confirm_action"),
        cancelLabel: t("confirm_cancel"),
      });
      if (!confirmed) return;
    }
    setBusy(true);
    try {
      onCode(await rotateInviteCode());
    } catch (err) {
      toastError({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    } finally {
      setBusy(false);
    }
  }

  return { busy, copyLink, copyCode, rotate };
}
