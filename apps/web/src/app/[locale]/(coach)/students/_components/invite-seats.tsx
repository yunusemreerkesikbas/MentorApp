"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Link2 } from "lucide-react";
import type { MentorshipCoachOverviewDto, MentorshipInviteCodeDto } from "@mentor/types";
import { Button, Skeleton, TextSwap } from "@mentor/ui";
import {
  PANEL_CARD,
  PANEL_CARD_TITLE,
  PANEL_QUIET_LINK,
  PANEL_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { ProgressLine } from "@/components/panel/progress-line";
import { Link } from "@/i18n/navigation";
import { CoachCheck } from "@/components/mentorship/coach-check";
import { InviteCodeRow, InviteExpiry } from "./invite-code-row";
import type { InviteLock } from "./invite-lock";
import { seatCardState } from "./seat-state";
import { useInviteActions } from "./use-invite-actions";

type Props = {
  overview: MentorshipCoachOverviewDto | null;
  inviteLock: InviteLock;
  onCode: (code: MentorshipInviteCodeDto) => void;
  /** The overview did not load: said calmly with a retry, never a skeleton left spinning. */
  failed?: boolean;
  onRetry?: () => void;
};

function OverviewFailed({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations("mentorship");
  return (
    <div role="alert" className="flex flex-col items-start gap-1">
      <p className={BODY}>{t("seats_load_failed")}</p>
      <button type="button" className={PANEL_QUIET_LINK} onClick={onRetry}>
        {t("roster_retry")}
      </button>
    </div>
  );
}

/**
 * The copy ledge's label: a drawn ✓ and "Kopyalandı" for 1.5 s after a copy. The longer label
 * stays in the grid, unseen, so the ledge keeps its width while the words swap.
 */
function CopyLinkLabel({ copied, iconClassName }: { copied: boolean; iconClassName: string }) {
  const t = useTranslations("mentorship");
  return (
    <>
      {copied ? (
        <CoachCheck draw className={iconClassName} />
      ) : (
        <Link2 className={iconClassName} aria-hidden />
      )}
      <span className="grid justify-items-center">
        <span aria-hidden className="invisible col-start-1 row-start-1">
          {t("invite_copy_link")}
        </span>
        <TextSwap
          className="col-start-1 row-start-1"
          text={copied ? t("invite_copied_short") : t("invite_copy_link")}
        />
      </span>
    </>
  );
}

const NOTE = "text-caption font-semibold leading-relaxed text-[var(--color-secondary)]";
const BODY = "text-body-sm leading-relaxed text-[var(--color-body)]";

/**
 * Invite and seats in the rail (DESIGN.md §6.1): can this coach take another student right now.
 * Every number is the server's (`seatAllowance` is where the accept lock refuses), so "full" here is
 * full there too. Full is not an error: no red, and the one commercial ask of the whole screen is
 * the link to a coach plan, shown only while one is on sale.
 */
export function InviteSeatsCard({ overview, inviteLock, onCode, failed = false, onRetry }: Props) {
  const t = useTranslations("mentorship");
  const state = seatCardState(overview, inviteLock);
  const code = overview?.inviteCode ?? null;
  const actions = useInviteActions({ inviteCode: code, inviteLock, onCode });

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-3.5`} aria-labelledby="invite-seats-title">
      <h2 id="invite-seats-title" className={PANEL_CARD_TITLE}>
        {t("invite_seats_title")}
      </h2>

      {failed && state.kind === "loading" ? (
        <OverviewFailed onRetry={onRetry} />
      ) : state.kind === "loading" ? (
        <Skeleton className="h-32 w-full rounded-[var(--radius-card)]" />
      ) : state.kind === "closed" ? (
        <>
          <p className={BODY}>{t("seats_closed")}</p>
          {code ? <InviteCodeRow code={code} /> : null}
        </>
      ) : state.kind === "locked" ? (
        <p className={BODY}>{t("invite_locked_standing")}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className={NOTE}>
              {t.rich("seats_used", {
                used: state.used,
                total: state.total,
                b: (chunks) => (
                  <strong className="font-black tabular-nums text-[var(--color-main)]">{chunks}</strong>
                ),
              })}
            </p>
            <ProgressLine
              label={t("seats_progress_label")}
              value={state.used}
              max={state.total}
              fillClassName="coach-draw-grow-x [--draw-dur:400ms]"
            />
            {state.kind === "open" ? (
              <p className={NOTE}>
                {state.paidSeats > 0
                  ? t("seats_split_paid", { free: state.freeSeats, paid: state.paidSeats })
                  : t("seats_split_free", { free: state.freeSeats })}
              </p>
            ) : null}
          </div>

          {state.kind === "full" ? (
            <>
              <p className={BODY}>
                {state.reason === "cap"
                  ? t("seats_full_cap", { total: state.total })
                  : overview && overview.paidSeats > 0
                    ? t("seats_full_paid", { next: state.used + 1 })
                    : t("seats_full_free", { used: state.used, next: state.used + 1 })}
              </p>
              {state.reason === "seats" && state.plansOnSale ? (
                <Link href="/subscription" className={`${PANEL_TEXT_LINK} self-start`}>
                  {t("seats_plans_link")}
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              ) : null}
            </>
          ) : code ? (
            <>
              <InviteCodeRow
                code={code}
                copied={actions.copied === "code"}
                onCopy={() => void actions.copyCode()}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => void actions.copyLink()}
              >
                <CopyLinkLabel copied={actions.copied === "link"} iconClassName="size-4" />
              </Button>
              <InviteExpiry code={code} busy={actions.busy} onRotate={() => void actions.rotate()} />
            </>
          ) : (
            <>
              <p className={BODY}>{t("invite_none")}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                busy={actions.busy}
                onClick={() => void actions.rotate()}
              >
                {t("invite_create")}
              </Button>
            </>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The round's body before the first student (DESIGN.md §6.1 empty state): the invitation IS the
 * hero, so its one filled ledge copies the link. The rail's seat card steps aside meanwhile.
 */
export function InviteHero({ overview, inviteLock, onCode, failed = false, onRetry }: Props) {
  const t = useTranslations("mentorship");
  const state = seatCardState(overview, inviteLock);
  const code = overview?.inviteCode ?? null;
  const actions = useInviteActions({ inviteCode: code, inviteLock, onCode });

  if (failed && state.kind === "loading") return <OverviewFailed onRetry={onRetry} />;
  if (state.kind === "loading") return <Skeleton className="h-14 w-full rounded-[var(--play-radius)]" />;
  if (state.kind === "closed") return <p className={BODY}>{t("seats_closed")}</p>;
  // An admin's decision: nothing to press that would not 403.
  if (state.kind === "locked") return <p className={BODY}>{t("invite_locked_standing")}</p>;

  return (
    <div className="flex flex-col gap-3">
      {code ? (
        <Button type="button" className="w-full sm:w-fit" onClick={() => void actions.copyLink()}>
          <CopyLinkLabel copied={actions.copied === "link"} iconClassName="size-5" />
        </Button>
      ) : (
        <Button type="button" className="w-full sm:w-fit" busy={actions.busy} onClick={() => void actions.rotate()}>
          {t("invite_create")}
        </Button>
      )}
      {state.kind === "open" ? (
        <p className={BODY}>
          {state.paidSeats > 0
            ? t("seats_split_paid", { free: state.freeSeats, paid: state.paidSeats })
            : t("seats_split_free", { free: state.freeSeats })}
        </p>
      ) : null}
      {code ? (
        <>
          <InviteCodeRow
            code={code}
            copied={actions.copied === "code"}
            onCopy={() => void actions.copyCode()}
          />
          <InviteExpiry code={code} busy={actions.busy} onRotate={() => void actions.rotate()} />
        </>
      ) : null}
    </div>
  );
}
