"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { BuddyUserRef, BuddyViewDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import {
  acceptBuddyRequest,
  deleteBuddyRequest,
  endBuddy,
  getBuddy,
  getBuddySuggestions,
  inviteBuddyToStudy,
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

  // Request by username (from suggestions or the invite input). Returns success so the
  // input can clear itself; the card flips to outgoing-pending via load() on success.
  const requestByUsername = async (username: string): Promise<boolean> => {
    setBusy(true);
    try {
      await sendBuddyRequest(username);
      load();
      return true;
    } catch (err) {
      showErrorToast({
        title: t("buddy_action_error_title"),
        message: err instanceof ApiClientError ? err.body.message : t("buddy_invite_not_found"),
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
      className="text-xs font-semibold disabled:opacity-50"
      style={{ color: tone === "accent" ? "var(--color-progress)" : "var(--color-secondary)" }}
    >
      {label}
    </button>
  );

  return (
    <Card className="flex flex-col gap-3 px-5 py-4">
      <span
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("buddy_title")}
      </span>

      {active ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <AuthorAvatar name={active.partner.displayName} size={40} src={active.partner.avatarUrl} />
            <div className="min-w-0 flex-1 leading-tight">
              <p
                className="truncate text-sm font-bold"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                {active.partner.displayName}
              </p>
              {active.partnerStudyingNow ? (
                <p
                  className="flex items-center gap-1.5 text-xs font-semibold"
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
                <p className="text-xs tabular-nums" style={{ color: "var(--color-secondary)" }}>
                  {t("buddy_active_stats", {
                    minutes: active.focusMinutesToday,
                    days: active.currentStreak,
                  })}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                disabled={busy || !active.canNudge}
                onClick={() =>
                  void run(nudgeBuddy, {
                    title: t("buddy_nudge_sent_title"),
                    message: t("buddy_nudge_sent_message", { name: active.partner.displayName }),
                  })
                }
                className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
                  color: "var(--color-main)",
                }}
              >
                {t("buddy_nudge")}
              </button>
              {endConfirm
                ? textButton(t("buddy_end_confirm"), () => void run(endBuddy), "accent")
                : textButton(t("buddy_end"), () => setEndConfirm(true))}
            </div>
          </div>
          {/* Partner already studying → the presence dot is the cue to join; no invite needed. */}
          {!active.partnerStudyingNow ? (
            <button
              type="button"
              disabled={busy || !active.canNudge}
              onClick={() =>
                void run(inviteBuddyToStudy, {
                  title: t("buddy_invite_study_sent_title"),
                  message: t("buddy_invite_study_sent_message", { name: active.partner.displayName }),
                })
              }
              className="w-full rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-40"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-progress) 14%, transparent)",
                color: "var(--color-main)",
              }}
            >
              {t("buddy_invite_study")}
            </button>
          ) : null}
        </div>
      ) : incoming.length > 0 || outgoing ? (
        <div className="flex flex-col gap-2.5">
          {incoming.map((req) => (
            <div key={req.id} className="flex items-center gap-3">
              <AuthorAvatar name={req.partner.displayName} size={32} src={req.partner.avatarUrl} />
              <p className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--color-main)" }}>
                <span className="font-bold">{req.partner.displayName}</span>{" "}
                {t("buddy_incoming_suffix")}
              </p>
              <div className="flex shrink-0 items-center gap-3">
                {textButton(t("buddy_accept"), () => void run(() => acceptBuddyRequest(req.id)), "accent")}
                {textButton(t("buddy_decline"), () => void run(() => deleteBuddyRequest(req.id)))}
              </div>
            </div>
          ))}
          {outgoing ? (
            <div className="flex items-center gap-3">
              <AuthorAvatar
                name={outgoing.partner.displayName}
                size={32}
                src={outgoing.partner.avatarUrl}
              />
              <p
                className="min-w-0 flex-1 truncate text-sm"
                style={{ color: "var(--color-secondary)" }}
              >
                {t("buddy_outgoing", { name: outgoing.partner.displayName })}
              </p>
              {textButton(t("buddy_cancel"), () => void run(() => deleteBuddyRequest(outgoing.id)))}
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
 * Empty state: a username invite box (always) + same-cohort suggestions with one-tap
 * request. When there's no one to suggest, a quiet community link sits below the box.
 * `onRequest` returns success so the invite input can clear itself.
 */
function BuddyEmptyState({
  busy,
  onRequest,
}: {
  busy: boolean;
  onRequest: (username: string) => Promise<boolean>;
}) {
  const t = useTranslations("session");
  const [suggestions, setSuggestions] = useState<BuddyUserRef[] | null>(null);
  const [inviteValue, setInviteValue] = useState("");

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

  const submitInvite = async () => {
    const username = inviteValue.trim().replace(/^@+/, "");
    if (!username || busy) return;
    const ok = await onRequest(username);
    if (ok) setInviteValue("");
  };

  const inviteBox = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submitInvite();
      }}
      className="flex flex-col gap-2"
    >
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("buddy_invite_title")}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inviteValue}
          onChange={(e) => setInviteValue(e.target.value)}
          placeholder={t("buddy_invite_placeholder")}
          aria-label={t("buddy_invite_title")}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-[var(--radius-card)] border bg-white/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          style={{ borderColor: "var(--color-progress-track)", color: "var(--color-main)" }}
        />
        <button
          type="submit"
          disabled={busy || !inviteValue.trim()}
          className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--color-progress)", color: "var(--color-bg)" }}
        >
          {t("buddy_invite_action")}
        </button>
      </div>
    </form>
  );

  const hasSuggestions = suggestions !== null && suggestions.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {inviteBox}

      {hasSuggestions ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("buddy_suggest_title")}
          </p>
          <ul className="flex flex-col gap-2.5">
            {suggestions.map((u) => (
              <li key={u.userId} className="flex items-center gap-3">
                <AuthorAvatar name={u.displayName} size={36} src={u.avatarUrl} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--color-main)" }}>
                    {u.displayName}
                  </p>
                  {u.username ? (
                    <p className="truncate text-xs" style={{ color: "var(--color-secondary)" }}>
                      @{u.username}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy || !u.username}
                  onClick={() => u.username && void onRequest(u.username)}
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
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
        // Suggestions resolved empty → a quiet path to find someone in the community.
        <Link
          href="/community"
          className="w-fit text-sm font-semibold hover:underline"
          style={{ color: "var(--color-progress)" }}
        >
          {t("buddy_empty_cta")}
        </Link>
      ) : null}
    </div>
  );
}
