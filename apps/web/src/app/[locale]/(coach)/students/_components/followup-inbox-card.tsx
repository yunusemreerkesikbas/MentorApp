"use client";

import { useCallback, useEffect, useState } from "react";
import type { MentorshipFollowupDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, Skeleton, SkeletonGroup } from "@mentor/ui";
import { useLocale, useTranslations } from "next-intl";

import { FollowupStatus } from "@/components/mentorship/followup-status";
import { Link } from "@/i18n/navigation";
import {
  fetchFollowupAvailability,
  fetchMentorshipFollowups,
} from "@/lib/mentorship-followups";
import { appendUniqueById } from "@/lib/mentorship-followup-state";
import { formatDate } from "../../_components/mentorship-format";

const PAGE_SIZE = 5;

export function FollowupInboxCard() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [items, setItems] = useState<MentorshipFollowupDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const loadPage = useCallback(async (nextPage: number) => {
    const result = await fetchMentorshipFollowups({
      view: "ACTIONABLE",
      page: nextPage,
      pageSize: PAGE_SIZE,
    });
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
        if (!availability.enabled) return;
        await loadPage(1);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setError(
          failure instanceof ApiClientError ? failure.message : common("error_unknown"),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [common, loadPage, reload]);

  async function loadMore() {
    setLoadingMore(true);
    setError(null);
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
      <div className="mb-4">
        <h2 className="text-base font-semibold" style={{ color: "var(--color-main)" }}>
          {t("followup_inbox_title")}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("followup_inbox_body")}
        </p>
      </div>

      <SkeletonGroup
        label={t("followup_loading")}
        loading={loading}
        revealed={
          error && items.length === 0 ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </p>
              <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
                {t("followup_retry")}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("followup_inbox_empty")}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <ul className="flex flex-col divide-y divide-[var(--color-border)]">
                {items.map((item) => (
                  <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <Link
                      href={{ pathname: "/students/[studentId]", params: { studentId: item.studentId } }}
                      className="block rounded-[var(--radius-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold" style={{ color: "var(--color-main)" }}>
                            {item.studentDisplayName}
                          </p>
                          <p className="mt-1 text-sm" style={{ color: "var(--color-body)" }}>
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
                            {item.followUpDate
                              ? t("followup_due", {
                                  date: formatDate(`${item.followUpDate}T12:00:00.000Z`, locale),
                                })
                              : t("followup_no_date")}
                          </p>
                        </div>
                        <FollowupStatus status={item.status} response={item.response} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              {error ? (
                <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>
                  {error}
                </p>
              ) : null}
              {items.length < total ? (
                <Button variant="secondary" busy={loadingMore} onClick={() => void loadMore()}>
                  {t("followup_load_more")}
                </Button>
              ) : null}
            </div>
          )
        }
        className="flex flex-col gap-3"
      >
        <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    </Card>
  );
}
