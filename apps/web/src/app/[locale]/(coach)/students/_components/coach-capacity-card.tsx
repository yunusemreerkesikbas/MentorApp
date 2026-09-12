"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy, Eye, EyeOff, Info, Link2 } from "lucide-react";
import type { MentorshipInviteCodeDto } from "@mentor/types";
import { Button, Card, Skeleton } from "@mentor/ui";
import { getPathname } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { formatDate } from "../../_components/mentorship-format";
import { maskInviteCode } from "./invite-code";
import type { InviteLock } from "./invite-lock";

/**
 * The invite code and the seat count, together, because they answer one question: can this coach
 * take another student right now.
 *
 * The quota (`mentorship.coach.max_active_students`) is enforced on the STUDENT's redemption, so
 * before this card existed the cap was invisible to the only person who could act on it — the coach
 * handed out a code, the student was refused with a 409, and the coach never found out. Rotation
 * stays available at the cap: a full roster still empties, and blocking it would invent a rule the
 * server does not have.
 *
 * Three things changed in the redesign, and each is a decision rather than a layout preference:
 *
 *  - **One primary action.** The card used to offer copy / copy-link / rotate at equal weight.
 *    What a coach actually sends is the link, so that is the button; the rest got quieter.
 *  - **The code rests masked.** It is a bearer secret (see `invite-code.ts`) and copying never
 *    needed it visible. Revealing is now a deliberate press.
 *  - **Rotation asks first.** It is irreversible and it kills every copy already in a student's
 *    hands — too much to hang off one click of the quietest control on the card.
 */
export function CoachCapacityCard({
  loaded,
  inviteCode,
  inviteLock,
  activeStudents,
  maxActiveStudents,
  freeSeats,
  paidSeats,
  usedSeats,
  sponsorshipEnabled,
  busy,
  onRotate,
}: {
  loaded: boolean;
  inviteCode: MentorshipInviteCodeDto | null;
  /** Why the code is withheld, if it is. Null means the coach simply has not issued one yet. */
  inviteLock: InviteLock;
  activeStudents: number;
  maxActiveStudents: number;
  /** Sponsored seats included at no cost. */
  freeSeats: number;
  /** Extra sponsored seats the coach's own plan pays for. 0 without a seat plan. */
  paidSeats: number;
  /** Seats in use, counted server-side — not every student consumes one. */
  usedSeats: number;
  sponsorshipEnabled: boolean;
  busy: boolean;
  onRotate: () => void;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const toast = useMentorToast();
  const dialog = useMentorDialog();
  const [revealed, setRevealed] = useState(false);
  const full = loaded && activeStudents >= maxActiveStudents;

  async function copyToClipboard(text: string, title: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success({ title });
    } catch {
      /* Clipboard can be blocked; "Göster" is the way back to the code either way. */
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

  /**
   * Confirmed only when a code exists. Creating the first one invalidates nothing, so asking then
   * would be a prompt with no stake in it — and a prompt a coach learns to dismiss is worse than
   * none at all on the press that does have a stake.
   */
  async function rotate() {
    if (inviteCode !== null) {
      const confirmed = await dialog.confirm({
        title: t("invite_rotate_confirm_title"),
        // The existing warning copy IS the confirm message; a second string would be the same
        // sentence maintained twice.
        message: t("invite_rotate_warning"),
        confirmLabel: t("invite_rotate_confirm_action"),
        cancelLabel: t("confirm_cancel"),
      });
      if (!confirmed) return;
    }
    onRotate();
  }

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold" style={{ color: "var(--color-main)" }}>
              {t("invite_title")}
            </h2>
            {/* The two explanatory paragraphs that used to own most of this card's height. A coach
                reads them once; they belong behind a hint, not above the thing they explain. */}
            <span
              title={t("invite_hint")}
              aria-label={t("invite_hint")}
              tabIndex={0}
              className="grid size-6 cursor-help place-items-center rounded-full"
              style={{ color: "var(--color-secondary)" }}
            >
              <Info aria-hidden size={16} strokeWidth={2} />
            </span>
          </div>
          {loaded && (
            <p
              className="text-xs font-medium tabular-nums"
              style={{ color: full ? "var(--color-danger)" : "var(--color-secondary)" }}
            >
              {t("capacity_value", { used: activeStudents, total: maxActiveStudents })}
            </p>
          )}
        </div>

        {full && (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("capacity_full")}
          </p>
        )}

        {/* The seat count is a different question from the roster cap: one says who the coach may
            follow, the other who they are paying Premium for. A coach handing out a code deserves
            to know which of the two they are about to spend. */}
        {loaded && sponsorshipEnabled && freeSeats + paidSeats > 0 && (
          <p className="text-sm" style={{ color: "var(--color-body)" }}>
            {t("seats_body", { used: usedSeats, total: freeSeats + paidSeats })}
            {/* Running out of seats never blocks a link — it only stops the sponsorship, and a
                coach reading "3/3" deserves to know the next student still joins. */}
            {usedSeats >= freeSeats + paidSeats ? ` ${t("seats_full")}` : ""}
          </p>
        )}

        {!loaded ? (
          <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
        ) : inviteCode ? (
          <>
            <Button fullWidth onClick={copyInviteLink}>
              <Link2 aria-hidden size={16} strokeWidth={2} />
              {t("invite_copy_link")}
            </Button>

            <div className="flex items-center gap-2">
              <code
                className="flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-[var(--radius-card)] px-3 text-[13px] tracking-[0.08em]"
                style={{
                  backgroundColor: "var(--color-surface-container)",
                  color: revealed ? "var(--color-main)" : "var(--color-secondary)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {revealed ? inviteCode.code : maskInviteCode(inviteCode.code)}
              </code>
              <IconButton
                label={revealed ? t("invite_hide") : t("invite_reveal")}
                onClick={() => setRevealed((prev) => !prev)}
              >
                {revealed ? (
                  <EyeOff aria-hidden size={16} strokeWidth={2} />
                ) : (
                  <Eye aria-hidden size={16} strokeWidth={2} />
                )}
              </IconButton>
              {/* Copying always sends the real code — masking hides it from the room, not from
                  the clipboard. */}
              <IconButton
                label={t("invite_copy")}
                onClick={() => copyToClipboard(inviteCode.code, t("invite_copied"))}
              >
                <Copy aria-hidden size={16} strokeWidth={2} />
              </IconButton>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
                {t("invite_expires", { date: formatDate(inviteCode.expiresAt, locale) })}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={rotate}
                className="cursor-pointer text-[13px] font-semibold underline decoration-1 underline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ color: "var(--color-secondary)" }}
              >
                {t("invite_rotate")}
              </button>
            </div>
          </>
        ) : inviteLock !== null ? (
          // No Create button: pressing it would 403. EMAIL is one click away and says so; STANDING
          // is an admin decision, so the card explains rather than offering a dead end. These two
          // stay full paragraphs rather than folding into the hint above — a hint is not where you
          // tell somebody why the thing in front of them is blocked.
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {inviteLock === "EMAIL" ? t("coach_email_unverified") : t("invite_locked_standing")}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("invite_none")}
            </span>
            <Button busy={busy} onClick={rotate}>
              {t("invite_create")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * A 36px square control. Local rather than a `@mentor/ui` variant: the shared Button is sized for
 * a labelled action (`px-6 py-3`), and these two sit beside a 36px code field where a label would
 * be noise — the icon plus its accessible name is the whole control.
 */
function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 flex-none cursor-pointer place-items-center rounded-[var(--radius-card)] border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{
        borderColor: "color-mix(in srgb, var(--color-secondary) 22%, transparent)",
        backgroundColor: "var(--color-surface)",
        color: "var(--color-main)",
      }}
    >
      {children}
    </button>
  );
}
