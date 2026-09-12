"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  MentorshipFollowupResponse,
  MentorshipSharedFollowupDto,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, Skeleton, SkeletonGroup } from "@mentor/ui";
import { useLocale, useTranslations } from "next-intl";

import { FollowupStatus } from "@/components/mentorship/followup-status";
import { appendUniqueById } from "@/lib/mentorship-followup-state";
import {
  fetchFollowupAvailability,
  fetchMyCoachFollowups,
  respondToMentorshipFollowup,
} from "@/lib/mentorship-followups";
import { formatDate } from "../../../(coach)/_components/mentorship-format";

const PAGE_SIZE = 10;

export function SharedFollowupsCard() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [items, setItems] = useState<MentorshipSharedFollowupDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const loadPage = useCallback(async (nextPage: number) => {
    const result = await fetchMyCoachFollowups(nextPage, PAGE_SIZE);
    setItems((current) =>
      nextPage === 1 ? result.items : appendUniqueById(current, result.items),
    );
    setPage(result.page);
    setTotal(result.total);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchFollowupAvailability()
      .then(async (availability) => {
        if (!active) return;
        setEnabled(availability.enabled);
        if (availability.enabled) await loadPage(1);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        if (failure instanceof ApiClientError && failure.body.code === "MENTORSHIP_FOLLOWUP_DISABLED") {
          setEnabled(false);
          return;
        }
        setError(failure instanceof ApiClientError ? failure.message : common("error_unknown"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [common, loadPage, reload]);

  async function respond(item: MentorshipSharedFollowupDto, response: MentorshipFollowupResponse) {
    if (response === "PENDING") return;
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await respondToMentorshipFollowup(item.id, {
        version: item.version,
        response,
      });
      setItems((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    } catch (failure) {
      setError(failure instanceof ApiClientError ? failure.message : common("error_unknown"));
      if (failure instanceof ApiClientError && failure.status === 409) {
        setReload((value) => value + 1);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      await loadPage(page + 1);
    } catch (failure) {
      setError(failure instanceof ApiClientError ? failure.message : common("error_unknown"));
    } finally {
      setLoadingMore(false);
    }
  }

  if (enabled === false) return null;

  return (
    <Card>
      <h2 className="text-base font-semibold" style={{ color: "var(--color-main)" }}>
        {t("followup_student_title")}
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("followup_student_body")}
      </p>
      <SkeletonGroup
        label={t("followup_loading")}
        loading={loading}
        revealed={
          error && items.length === 0 ? (
            <div role="alert" className="mt-4 flex flex-col items-start gap-3">
              <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>
              <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
                {t("followup_retry")}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="mt-4 text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("followup_student_empty")}
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <ul className="flex flex-col gap-4">
                {items.map((item) => (
                  <li key={item.id} className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="whitespace-pre-line text-sm" style={{ color: "var(--color-main)" }}>
                        {item.sharedDecision}
                      </p>
                      <FollowupStatus status={item.status} response={item.response} />
                    </div>
                    <p className="mt-2 text-xs" style={{ color: "var(--color-secondary)" }}>
                      {item.followUpDate
                        ? t("followup_due", { date: formatDate(`${item.followUpDate}T12:00:00.000Z`, locale) })
                        : t("followup_no_date")}
                    </p>
                    {item.status === "OPEN" ? (
                      <div className="mt-4 flex flex-wrap gap-3" aria-label={t("followup_response_actions")}>
                        <Button
                          variant={item.response === "ACCEPTED" ? "soft" : "secondary"}
                          busy={busyId === item.id}
                          disabled={busyId !== null || item.response === "ACCEPTED"}
                          onClick={() => void respond(item, "ACCEPTED")}
                        >
                          {t("followup_accept")}
                        </Button>
                        <Button
                          variant={item.response === "CHANGE_REQUESTED" ? "soft" : "ghost"}
                          busy={busyId === item.id}
                          disabled={busyId !== null || item.response === "CHANGE_REQUESTED"}
                          onClick={() => void respond(item, "CHANGE_REQUESTED")}
                        >
                          {t("followup_change_request")}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {error ? <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p> : null}
              {items.length < total ? (
                <Button variant="secondary" busy={loadingMore} onClick={() => void loadMore()}>
                  {t("followup_load_more")}
                </Button>
              ) : null}
            </div>
          )
        }
        className="mt-4 flex flex-col gap-3"
      >
        <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    </Card>
  );
}
