"use client";

import { useLocale, useTranslations } from "next-intl";
import type { MentorshipInviteCodeDto } from "@mentor/types";
import { Button, Card, Skeleton } from "@mentor/ui";
import { getPathname } from "@/i18n/navigation";
import { useMentorToast } from "@/lib/mentor-toast";
import { formatDate } from "../../_components/mentorship-format";

/**
 * The invite code and the seat count, together, because they answer one question: can this coach
 * take another student right now.
 *
 * The quota (`mentorship.coach.max_active_students`) is enforced on the STUDENT's redemption, so
 * before this card existed the cap was invisible to the only person who could act on it — the coach
 * handed out a code, the student was refused with a 409, and the coach never found out. Rotation
 * stays available at the cap: a full roster still empties, and blocking it would invent a rule the
 * server does not have.
 */
export function CoachCapacityCard({
  loaded,
  inviteCode,
  activeStudents,
  maxActiveStudents,
  busy,
  onRotate,
}: {
  loaded: boolean;
  inviteCode: MentorshipInviteCodeDto | null;
  activeStudents: number;
  maxActiveStudents: number;
  busy: boolean;
  onRotate: () => void;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const toast = useMentorToast();
  const full = loaded && activeStudents >= maxActiveStudents;

  async function copyToClipboard(text: string, title: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success({ title });
    } catch {
      /* Clipboard can be blocked; the code is on screen to read either way. */
    }
  }

  /**
   * The same code as a link the coach can paste into a message. `?code=` only fills the field in:
   * the invitation screen still asks the student to look up the code and confirm the data scope,
   * because clicking a link somebody sent is not consent.
   */
  async function copyInviteLink() {
    if (!inviteCode) return;
    const path = getPathname({ href: "/coach-invitation", locale });
    await copyToClipboard(
      `${window.location.origin}${path}?code=${encodeURIComponent(inviteCode.code)}`,
      t("invite_link_copied"),
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
            {t("invite_title")}
          </h2>
          {loaded && (
            <p
              className="text-xs font-medium"
              style={{ color: full ? "var(--color-danger)" : "var(--color-secondary)" }}
            >
              {t("capacity_value", { used: activeStudents, total: maxActiveStudents })}
            </p>
          )}
        </div>
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {full ? t("capacity_full") : t("invite_body")}
        </p>
        {!loaded ? (
          <Skeleton className="h-10 w-64 rounded-[var(--radius-card)]" />
        ) : inviteCode ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <code
                className="rounded-[var(--radius-card)] px-3 py-2 text-sm font-semibold tracking-wide"
                style={{ backgroundColor: "var(--color-surface)", color: "var(--color-main)" }}
              >
                {inviteCode.code}
              </code>
              <Button
                variant="soft"
                onClick={() => copyToClipboard(inviteCode.code, t("invite_copied"))}
              >
                {t("invite_copy")}
              </Button>
              <Button variant="soft" onClick={copyInviteLink}>
                {t("invite_copy_link")}
              </Button>
              <Button variant="ghost" busy={busy} onClick={onRotate}>
                {t("invite_rotate")}
              </Button>
            </div>
            <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
              {t("invite_expires", { date: formatDate(inviteCode.expiresAt, locale) })}
              {" · "}
              {t("invite_rotate_warning")}
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("invite_none")}
            </span>
            <Button busy={busy} onClick={onRotate}>
              {t("invite_create")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
