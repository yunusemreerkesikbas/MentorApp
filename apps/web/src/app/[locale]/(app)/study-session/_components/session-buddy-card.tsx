"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Hand } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BuddySuggestionRef, BuddyViewDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import {
  PANEL_CARD_TITLE,
  PANEL_QUIET_LINK,
  PANEL_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { PuhuImage } from "@/components/puhu-image";
import {
  acceptBuddyRequest,
  deleteBuddyRequest,
  endBuddy,
  getBuddy,
  getBuddySuggestions,
  nudgeBuddy,
  sendBuddyRequest,
} from "@/lib/buddy";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { AuthorAvatar } from "../../community/_components/author-avatar";
import { SESSION_CARD_CLASS } from "./session-today-card";

type State =
  | { status: "loading" }
  | { status: "hidden" } // API error → degrade silently, the card just disappears
  | { status: "ready"; view: BuddyViewDto };

/**
 * "Yol arkadaşın" on the /seans rail: the active partner (today's effort, live presence, a
 * nudge), a request either way, or the people you already studied beside. Effort only, never
 * results.
 *
 * Actions are the panel's: an outline ledge for the one thing to do ("Dürt", "Kabul et"),
 * quiet links for the rest. The page's single filled ledge stays "Başla".
 */
export function SessionBuddyCard() {
  const t = useTranslations("session");
  const titleId = useId();
  const dialog = useMentorDialog();
  const { error: showErrorToast, success: showSuccessToast } = useMentorToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getBuddy()
      .then((view) => setState({ status: "ready", view }))
      .catch(() => setState({ status: "hidden" }));
  }, []);

  // Silent refetch for polling — a transient failure must not hide the card.
  const refresh = useCallback(() => {
    getBuddy()
      .then((view) => setState({ status: "ready", view }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the partner's "studying now" presence live while an active pairing is shown.
  const hasActivePair = state.status === "ready" && state.view.active !== null;
  useEffect(() => {
    if (!hasActivePair) return;
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [hasActivePair, refresh]);

  const run = async (action: () => Promise<void>, successToast?: { title: string; message?: string }) => {
    setBusy(true);
    try {
      await action();
      if (successToast) showSuccessToast({ ...successToast, duration: 2500 });
      load();
    } catch (err) {
      showErrorToast({
        title: t("buddy_action_error_title"),
        message: err instanceof ApiClientError ? err.body.message : undefined,
        duration: 3000,
      });
    } finally {
      setBusy(false);
    }
  };

  // Ending a pairing hides both people's effort from each other, so it asks in the kit's
  // destructive confirm instead of relabelling the link and waiting for a second tap.
  const endPairing = async (partnerName: string) => {
    const confirmed = await dialog.confirm({
      title: t("buddy_end_confirm_title"),
      message: t("buddy_end_confirm_body", { name: partnerName }),
      confirmLabel: t("buddy_end_confirm_action"),
      cancelLabel: t("goal_cancel"),
      destructive: true,
    });
    if (confirmed) await run(endBuddy);
  };

  // Request a buddy from the cohort suggestion list. The card flips to outgoing-pending via
  // load(). (The username invite box moved to study rooms — finding someone by handle was
  // exactly the friction the invite code removes.)
  const requestByUsername = async (username: string) => {
    setBusy(true);
    try {
      await sendBuddyRequest(username);
      load();
    } catch (err) {
      showErrorToast({
        title: t("buddy_action_error_title"),
        message: err instanceof ApiClientError ? err.body.message : undefined,
        duration: 3000,
      });
    } finally {
      setBusy(false);
    }
  };

  if (state.status === "hidden") return null;
  if (state.status === "loading") return <SessionBuddyCardSkeleton />;
  const { active, outgoing, incoming } = state.view;

  return (
    <section className={SESSION_CARD_CLASS} aria-labelledby={titleId}>
      <h2 id={titleId} className={PANEL_CARD_TITLE}>
        {t("buddy_title")}
      </h2>

      {active ? (
        <>
          <div className="flex items-center gap-3">
            <AuthorAvatar name={active.partner.displayName} size={44} src={active.partner.avatarUrl} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="truncate text-body-sm font-extrabold text-[var(--color-main)]">
                {active.partner.displayName}
              </p>
              {active.partnerStudyingNow ? (
                <p className="inline-flex items-center gap-1.5 text-caption font-extrabold text-[var(--color-main)]">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full bg-[var(--color-success)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success)_24%,transparent)]"
                  />
                  {t("buddy_studying_now")}
                </p>
              ) : (
                <p className="text-caption font-semibold text-[var(--color-secondary)]">
                  {t("buddy_active_stats", {
                    minutes: active.focusMinutesToday,
                    days: active.currentStreak,
                  })}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !active.canNudge}
              onClick={() =>
                void run(nudgeBuddy, {
                  title: t("buddy_nudge_sent_title"),
                  message: t("buddy_nudge_sent_message", { name: active.partner.displayName }),
                })
              }
            >
              <Hand className="size-[18px]" strokeWidth={1.75} aria-hidden />
              {t("buddy_nudge")}
            </Button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void endPairing(active.partner.displayName)}
            className={`${PANEL_QUIET_LINK} -mb-1 self-start`}
          >
            {t("buddy_end")}
          </button>
        </>
      ) : incoming.length > 0 || outgoing ? (
        <div className="flex flex-col gap-4">
          {incoming.map((req) => (
            <div key={req.id} className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <AuthorAvatar name={req.partner.displayName} size={40} src={req.partner.avatarUrl} />
                <p className="min-w-0 flex-1 text-body-sm font-semibold text-[var(--color-body)]">
                  <span className="font-extrabold text-[var(--color-main)]">{req.partner.displayName}</span>{" "}
                  {t("buddy_incoming_suffix")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 pl-[52px]">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void run(() => acceptBuddyRequest(req.id))}
                >
                  {t("buddy_accept")}
                </Button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => deleteBuddyRequest(req.id))}
                  className={PANEL_QUIET_LINK}
                >
                  {t("buddy_decline")}
                </button>
              </div>
            </div>
          ))}
          {outgoing ? (
            <div className="flex items-center gap-3">
              <AuthorAvatar name={outgoing.partner.displayName} size={40} src={outgoing.partner.avatarUrl} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-body-sm font-extrabold text-[var(--color-main)]">
                  {outgoing.partner.displayName}
                </p>
                <p className="text-caption font-semibold text-[var(--color-secondary)]">
                  {t("buddy_outgoing_waiting")}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => deleteBuddyRequest(outgoing.id))}
                className={PANEL_QUIET_LINK}
              >
                {t("buddy_cancel")}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <BuddySuggestions busy={busy} onRequest={(username) => void requestByUsername(username)} />
      )}
    </section>
  );
}

/**
 * No pairing yet: the people you already studied beside at a table, one tap each. When there
 * is nobody to suggest, Puhu points at the tables instead of at a directory of strangers.
 */
function BuddySuggestions({
  busy,
  onRequest,
}: {
  busy: boolean;
  onRequest: (username: string) => void;
}) {
  const t = useTranslations("session");
  const [suggestions, setSuggestions] = useState<BuddySuggestionRef[] | null>(null);

  useEffect(() => {
    let active = true;
    getBuddySuggestions()
      .then((res) => {
        if (active) setSuggestions(res);
      })
      .catch(() => {
        if (active) setSuggestions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (suggestions === null) {
    return <Skeleton className="h-11 w-full rounded-[var(--radius-card)]" />;
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex items-center gap-3 py-1">
        <PuhuImage variant="encouraging" size={56} className="shrink-0" />
        <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("buddy_empty_hint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <p className="text-caption font-semibold text-[var(--color-secondary)]">{t("buddy_suggest_title")}</p>
      <ul className="flex flex-col">
        {suggestions.map((u, index) => (
          <li
            key={u.userId}
            className={`flex items-center gap-3 py-2.5${index > 0 ? " border-t border-[var(--play-line)]" : ""}`}
          >
            <AuthorAvatar name={u.displayName} size={36} src={u.avatarUrl} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="truncate text-body-sm font-extrabold text-[var(--color-main)]" title={u.displayName}>
                {u.displayName}
              </p>
              {/* The reason they are here, in place of the handle nobody types any more. */}
              <p className="truncate text-caption font-semibold text-[var(--color-secondary)]">
                {t("buddy_together_count", { count: u.sessionsTogether })}
              </p>
            </div>
            <button
              type="button"
              disabled={busy || !u.username}
              onClick={() => u.username && onRequest(u.username)}
              className={`${PANEL_TEXT_LINK} shrink-0`}
            >
              {t("buddy_suggest_action")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SessionBuddyCardSkeleton() {
  const t = useTranslations("session");
  return (
    <SkeletonGroup label={t("loading")} className={SESSION_CARD_CLASS}>
      <Skeleton className="h-5 w-32 rounded-[var(--radius-card)]" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded-[var(--radius-card)]" />
          <Skeleton className="h-3 w-20 rounded-[var(--radius-card)]" />
        </div>
      </div>
    </SkeletonGroup>
  );
}
