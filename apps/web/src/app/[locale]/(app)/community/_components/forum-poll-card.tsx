"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ForumPollView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { votePoll } from "@/lib/forum";

export function ForumPollCard({ poll, onChange }: { poll: ForumPollView; onChange: (poll: ForumPollView) => void }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const [busyOptionId, setBusyOptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vote = async (optionId: string) => {
    if (!poll.canVote || busyOptionId) return;
    setBusyOptionId(optionId);
    setError(null);
    try {
      onChange(await votePoll(poll.id, optionId));
    } catch (voteError) {
      setError(voteError instanceof ApiClientError ? voteError.body.message : t("poll_vote_error"));
    } finally {
      setBusyOptionId(null);
    }
  };

  return (
    <section
      className="mt-3 grid gap-2"
      aria-label={t("poll_title")}
      aria-busy={Boolean(busyOptionId)}
      role={poll.resultsVisible ? undefined : "radiogroup"}
    >
      {poll.options.map((option) => {
        const selected = poll.myOptionId === option.id;
        if (!poll.resultsVisible) {
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={false}
              disabled={!poll.canVote || Boolean(busyOptionId)}
              onClick={() => void vote(option.id)}
              className="flex min-h-11 w-full items-center justify-between rounded-full border border-[var(--community-blue-border)] px-4 text-left text-sm font-bold text-[var(--community-blue-ink)] transition-colors hover:bg-[var(--community-blue-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
            >
              <span>{option.text}</span>
              {busyOptionId === option.id ? <span className="text-xs">{t("loading")}</span> : null}
            </button>
          );
        }

        return (
          <div key={option.id} className="relative min-h-11 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]">
            <div className="absolute inset-y-0 left-0 bg-[var(--community-blue-soft)] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${option.percentage ?? 0}%` }} aria-hidden />
            <div
              role="progressbar"
              aria-label={option.text}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={option.percentage ?? 0}
              className="relative flex min-h-11 items-center justify-between gap-3 px-4 text-sm text-[var(--color-main)]"
            >
              <span className="flex min-w-0 items-center gap-2 font-bold">
                {selected ? <Check size={16} aria-label={t("poll_selected")} /> : null}
                <span className="truncate">{option.text}</span>
              </span>
              <span className="shrink-0 font-extrabold tabular-nums">{option.percentage ?? 0}%</span>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-secondary)]">
        <span>{t("poll_votes", { count: poll.totalVoteCount })}</span>
        <span aria-hidden>·</span>
        <span>{poll.status === "CLOSED" ? t("poll_closed") : t("poll_ends_at", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(poll.endsAt)) })}</span>
      </div>
      {error ? <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p> : null}
    </section>
  );
}
