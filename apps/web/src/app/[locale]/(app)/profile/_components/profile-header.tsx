"use client";

import { VerifiedCheckIcon as BadgeCheck } from "@solar-icons/react/bold/verified-check";
import { RefreshIcon as LoaderCircle } from "@solar-icons/react/linear/refresh";
import { LetterUnreadIcon as MailWarning } from "@solar-icons/react/bold/letter-unread";
import { Pen2Icon as Pencil } from "@solar-icons/react/linear/pen-2";
import { AltArrowRightIcon as ChevronRight } from "@solar-icons/react/linear/alt-arrow-right";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ApiClientError, usersControllerResendVerificationEmail } from "@mentor/api-client";
import { useDialog } from "@mentor/ui";
import type { AuthUser } from "@mentor/types";
import { PremiumIdentityMark } from "@/components/premium/premium-identity-mark";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorToast } from "@/lib/mentor-toast";
import { useAccountSecurity } from "@/lib/use-account-security";
import { ProfileAvatar, ProfileEditForm } from "./profile-edit-form";

/**
 * Profile identity row — Nuton thumb placeholder (#D6DBFD) + Plus Jakarta Sans name stack.
 */
export function ProfileHeader({
  autoOpenEdit = false,
  onSaved,
  premium = false,
  user,
}: {
  autoOpenEdit?: boolean;
  onSaved: (user: AuthUser) => void;
  premium?: boolean;
  user: AuthUser;
}) {
  const t = useTranslations("profile");
  const dialog = useDialog();
  const sheet = useMentorBottomSheet();
  const toast = useMentorToast();
  const signInAgain = useAccountSecurity();
  const [resendingVerification, setResendingVerification] = useState(false);
  const didAutoOpenEdit = useRef(false);

  const openEditDialog = useCallback(() => {
    sheet.show({
      title: t("edit.title"),
      layout: "filter",
      dismissOnBackdrop: false,
      children: (
        <ProfileEditForm
          user={user}
          onCancel={sheet.dismiss}
          onSignInAgain={signInAgain}
          onSaved={(next) => {
            onSaved(next);
            sheet.dismiss();
          }}
        />
      ),
    });
  }, [onSaved, sheet, signInAgain, t, user]);

  useEffect(() => {
    if (!autoOpenEdit || didAutoOpenEdit.current) return;
    didAutoOpenEdit.current = true;
    openEditDialog();
  }, [autoOpenEdit, openEditDialog]);

  async function resendVerificationEmail() {
    if (resendingVerification) return;
    setResendingVerification(true);
    try {
      await usersControllerResendVerificationEmail();
      dialog.info({
        title: t("verification_sent_title"),
        message: t("verification_sent_message"),
        okLabel: t("verification_sent_ok"),
        closeLabel: t("verification_sent_ok"),
      });
    } catch (err) {
      toast.error({
        title: t("verification_send_error_title"),
        message:
          err instanceof ApiClientError
            ? err.body.message
            : t("verification_send_error_message"),
        duration: 3000,
      });
    } finally {
      setResendingVerification(false);
    }
  }

  return (
    <section className="flex flex-col items-center px-2 pb-1 pt-2 text-center">
      <div className="relative">
        <ProfileAvatar alt={t("edit.avatar_alt", { name: user.displayName })} user={user} />
        <button
          type="button"
          onClick={openEditDialog}
          aria-label={t("edit.action")}
          title={t("edit.action")}
          className="absolute -right-2 top-1 grid min-h-11 min-w-11 place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-main)] shadow-[var(--shadow-card)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_3%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Pencil size={17} aria-hidden />
        </button>
        {user.emailVerified ? (
          <span
            role="img"
            aria-label={t("email_verified")}
            title={t("email_verified")}
            className="absolute -right-1 bottom-1 grid size-8 place-items-center rounded-full border-2 border-[var(--color-bg)] bg-[var(--color-surface)] text-[var(--color-main)] shadow-[var(--shadow-card)]"
          >
            <BadgeCheck size={17} strokeWidth={1.75} aria-hidden />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void resendVerificationEmail()}
            disabled={resendingVerification}
            aria-label={
              resendingVerification
                ? t("verification_sending")
                : t("verification_resend_action")
            }
            title={t("status_unverified")}
            className="absolute -right-2 bottom-0 grid min-h-11 min-w-11 place-items-center rounded-full text-[var(--color-chip-text)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none"
          >
            <span
              className="grid size-8 place-items-center rounded-full border-2 border-[var(--color-bg)] shadow-[var(--shadow-card)]"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-chip) 38%, var(--color-surface))",
              }}
            >
              {resendingVerification ? (
                <LoaderCircle
                  size={16}
                  strokeWidth={1.75}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : (
                <MailWarning size={16} strokeWidth={1.75} aria-hidden />
              )}
            </span>
          </button>
        )}
      </div>
      <div className="mt-3 flex max-w-full flex-wrap items-center justify-center gap-2">
        <h1
          className="max-w-full break-words text-4xl font-bold leading-none text-balance"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {user.displayName}
        </h1>
        {premium ? <PremiumIdentityMark /> : null}
      </div>
      <p className="mt-2 max-w-full truncate text-sm text-[var(--color-secondary)]">
        {user.username ? `@${user.username}` : user.email}
      </p>
      {user.username ? (
        <Link
          href={{
            pathname: "/community/member/[username]",
            params: { username: user.username },
          }}
          className="mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-accent)" }}
        >
          {t("community_profile_link")}
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

