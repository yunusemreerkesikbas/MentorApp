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
        {/* The one mark on the avatar (DESIGN.md §icons): the edit control, at the conventional
            bottom-right corner. 44px hit area around a 36px disc. */}
        <button
          type="button"
          onClick={openEditDialog}
          aria-label={t("edit.action")}
          title={t("edit.action")}
          className="group absolute -bottom-1.5 -right-1.5 grid size-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <span className="grid size-9 place-items-center rounded-full border-2 border-[var(--color-bg)] bg-[var(--color-surface)] text-[var(--color-main)] shadow-[var(--shadow-card)] transition-colors group-hover:bg-[var(--color-surface-container)] motion-reduce:transition-none">
            <Pencil size={16} strokeWidth={1.75} aria-hidden />
          </span>
        </button>
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
      {/* Email status sits on the identity line, in words: a tick on the avatar read as a
          "verified coach" stamp, and with a username the email it vouched for was not shown. */}
      <div className="mt-2 flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-[var(--color-secondary)]">
        <span className="max-w-full truncate">
          {user.username ? `@${user.username}` : user.email}
        </span>
        <span aria-hidden>·</span>
        {user.emailVerified ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-success)]">
            <BadgeCheck size={14} aria-hidden />
            {t("email_verified")}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void resendVerificationEmail()}
            disabled={resendingVerification}
            title={t("verification_resend_action")}
            className="group inline-flex min-h-11 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed"
          >
            <span
              className="inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-[var(--color-main)] transition-colors group-hover:bg-[color-mix(in_srgb,var(--color-star)_34%,var(--color-surface))] group-disabled:opacity-60 motion-reduce:transition-none"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-star) 22%, var(--color-surface))",
              }}
            >
              {resendingVerification ? (
                <LoaderCircle
                  size={14}
                  strokeWidth={1.75}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : (
                <MailWarning size={14} aria-hidden />
              )}
              {resendingVerification
                ? t("verification_sending")
                : t("verify_email_cta")}
              {resendingVerification ? null : (
                <ChevronRight size={12} strokeWidth={1.75} aria-hidden />
              )}
            </span>
          </button>
        )}
      </div>
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

