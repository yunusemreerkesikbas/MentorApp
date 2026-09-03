"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { BuddySuggestionRef, BuddyViewDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card } from "@mentor/ui";
import {
  acceptBuddyRequest,
  deleteBuddyRequest,
  endBuddy,
  getBuddy,
  getBuddySuggestions,
  nudgeBuddy,
  sendBuddyRequest,
} from "@/lib/buddy";
import { useMentorToast } from "@/lib/mentor-toast";
import { AuthorAvatar } from "../../community/_components/author-avatar";

type State =
  | { status: "loading" }
  | { status: "hidden" } // API error → degrade silently, the card just disappears
  | { status: "ready"; view: BuddyViewDto };

/**
 * Study-buddy card on the /study-session idle screen: active partner (today's effort + nudge),
 * incoming/outgoing requests, or a quiet empty-state invite. Effort only — never results.
 */
export function SessionBuddyCard() {
  const t = useTranslations("session");
  const { error: showErrorToast, success: showSuccessToast } = useMentorToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);

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
      setEndConfirm(false);
    }
  };

  // Request a buddy from the cohort suggestion list. Returns success so the caller can react;
  // the card flips to outgoing-pending via load(). (The username invite box moved to study
  // rooms — finding someone by handle was exactly the friction the invite code removes.)
  const requestByUsername = async (username: string): Promise<boolean> => {
    setBusy(true);
    try {
      await sendBuddyRequest(username);
      load();
      return true;
    } catch (err) {
      showErrorToast({
        title: t("buddy_action_error_title"),
        message: err instanceof ApiClientError ? err.body.message : undefined,
        duration: 3000,
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (state.status === "loading" || state.status === "hidden") return null;
  const { active, outgoing, incoming } = state.view;

  const textButton = (label: string, onClick: () => void, tone: "accent" | "quiet" = "quiet") => (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="min-h-11 cursor-pointer text-sm font-semibold disabled:opacity-50"
      style={{ color: tone === "accent" ? "var(--color-progress)" : "var(--color-secondary)" }}
    >
      {label}
    </button>
  );

  return (
    <Card className="flex flex-col gap-4 px-4 py-4 session-liquid-card">
      <span
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("buddy_title")}
      </span>

      {active ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <AuthorAvatar name={active.partner.displayName} size={40} src={active.partner.avatarUrl} />
            <div className="min-w-0 flex-1 leading-snug">
              <p
                className="truncate text-sm font-bold"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                {active.partner.displayName}
              </p>
              {active.partnerStudyingNow ? (
                <p
                  className="mt-1 flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: "var(--color-success)" }}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full animate-pulse motion-reduce:animate-none"
                    style={{ backgroundColor: "var(--color-success)" }}
                  />
                  {t("buddy_studying_now")}
                </p>
              ) : (
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-secondary)" }}>
                  {t("buddy_active_stats", {
                    minutes: active.focusMinutesToday,
                    days: active.currentStreak,
                  })}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy || !active.canNudge}
              onClick={() =>
                void run(nudgeBuddy, {
                  title: t("buddy_nudge_sent_title"),
                  message: t("buddy_nudge_sent_message", { name: active.partner.displayName }),
                })
              }
              className="min-h-11 w-full cursor-pointer rounded-[var(--radius-card)] text-sm font-semibold disabled:opacity-40"
              style={{
                backgroundColor: "var(--color-surface-container)",
                color: "var(--color-main)",
              }}
            >
              {t("buddy_nudge")}
            </button>
            <div className="flex justify-center">
              {endConfirm
                ? textButton(t("buddy_end_confirm"), () => void run(endBuddy), "accent")
                : textButton(t("buddy_end"), () => setEndConfirm(true))}
            </div>
          </div>
        </div>
      ) : incoming.length > 0 || outgoing ? (
        <div className="flex flex-col gap-4">
          {incoming.map((req) => (
            <div key={req.id} className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <AuthorAvatar name={req.partner.displayName} size={36} src={req.partner.avatarUrl} />
                <p className="min-w-0 flex-1 text-sm leading-relaxed" style={{ color: "var(--color-main)" }}>
                  <span className="font-bold">{req.partner.displayName}</span>{" "}
                  {t("buddy_incoming_suffix")}
                </p>
              </div>
              <div className="flex items-center gap-4 px-0.5">
                {textButton(t("buddy_accept"), () => void run(() => acceptBuddyRequest(req.id)), "accent")}
                {textButton(t("buddy_decline"), () => void run(() => deleteBuddyRequest(req.id)))}
              </div>
            </div>
          ))}
          {outgoing ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <AuthorAvatar
                  name={outgoing.partner.displayName}
                  size={36}
                  src={outgoing.partner.avatarUrl}
                />
                <p
                  className="min-w-0 flex-1 text-sm leading-relaxed"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("buddy_outgoing", { name: outgoing.partner.displayName })}
                </p>
              </div>
              <div className="px-0.5">
                {textButton(t("buddy_cancel"), () => void run(() => deleteBuddyRequest(outgoing.id)))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <BuddyEmptyState busy={busy} onRequest={requestByUsername} />
      )}
    </Card>
  );
}

/**
 * Empty state: same-cohort suggestions with a one-tap request. When there's no one to suggest,
 * a quiet community link takes its place.
 */
function BuddyEmptyState({
  busy,
  onRequest,
}: {
  busy: boolean;
  onRequest: (username: string) => Promise<boolean>;
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

  const hasSuggestions = suggestions !== null && suggestions.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {hasSuggestions ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("buddy_suggest_title")}
          </p>
          <ul className="flex flex-col gap-3">
            {suggestions.map((u) => (
              <li key={u.userId} className="flex flex-col gap-2">
                {/* Two rows, not one: in the 288px sidebar a name, a handle and a button on the
                    same line left ~90px for the name and truncated almost everyone. */}
                <div className="flex items-center gap-3">
                  <AuthorAvatar name={u.displayName} size={36} src={u.avatarUrl} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: "var(--color-main)" }}
                      title={u.displayName}
                    >
                      {u.displayName}
                    </p>
                    {/* The reason they are here, in place of the handle nobody types any more. */}
                    <p className="truncate text-xs" style={{ color: "var(--color-secondary)" }}>
                      {t("buddy_together_count", { count: u.sessionsTogether })}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || !u.username}
                  onClick={() => u.username && void onRequest(u.username)}
                  className="min-h-11 w-full cursor-pointer rounded-[var(--radius-card)] text-sm font-semibold disabled:opacity-50"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-progress) 14%, transparent)",
                    color: "var(--color-main)",
                  }}
                >
                  {t("buddy_suggest_action")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : suggestions !== null ? (
        // Nobody to suggest yet: a buddy is earned at a table, so point there rather than at a
        // directory of strangers.
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>
          {t("buddy_empty_hint")}
        </p>
      ) : null}
    </div>
  );
}
