"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MentorshipFollowupDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { useTranslations } from "next-intl";

import { appendUniqueById } from "@/lib/mentorship-followup-state";
import {
  fetchFollowupAvailability,
  fetchMentorshipFollowups,
} from "@/lib/mentorship-followups";
import { useMentorToast } from "@/lib/mentor-toast";
import { FollowupCreateForm } from "./followup-create-form";
import { FollowupHistoryItem } from "./followup-history-item";

const PAGE_SIZE = 10;

export function FollowupPanel({ studentId }: { studentId: string }) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const formRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [items, setItems] = useState<MentorshipFollowupDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<MentorshipFollowupDto | null>(null);
  const [reload, setReload] = useState(0);

  const loadPage = useCallback(
    async (nextPage: number) => {
      const result = await fetchMentorshipFollowups({
        studentId,
        view: "ALL",
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setItems((current) =>
        nextPage === 1 ? result.items : appendUniqueById(current, result.items),
      );
      setPage(result.page);
      setTotal(result.total);
    },
    [studentId],
  );

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
        if (
          failure instanceof ApiClientError &&
          failure.body.code === "MENTORSHIP_FOLLOWUP_DISABLED"
        ) {
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

  const refresh = useCallback(() => {
    setReplacement(null);
    setReload((value) => value + 1);
  }, []);

  const handleError = useCallback(
    (failure: unknown) => {
      const message = failure instanceof ApiClientError ? failure.message : common("error_unknown");
      toast.error({ title: common("error_title"), message });
      if (failure instanceof ApiClientError && failure.status === 409) {
        setReload((value) => value + 1);
      }
    },
    [common, toast],
  );

  async function loadMore() {
    setLoadingMore(true);
    try {
      await loadPage(page + 1);
    } catch (failure) {
      handleError(failure);
    } finally {
      setLoadingMore(false);
    }
  }

  function replace(item: MentorshipFollowupDto) {
    setReplacement(item);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  if (enabled === false) return null;

  return (
    <section aria-labelledby="followup-panel-title" className="flex flex-col gap-4">
      <div>
        <h2 id="followup-panel-title" className="text-xl font-semibold" style={{ color: "var(--color-main)" }}>
          {t("followup_history_title")}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("followup_history_body")}
        </p>
      </div>

      <SkeletonGroup
        label={t("followup_loading")}
        loading={loading}
        revealed={
          error ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>
              <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
                {t("followup_retry")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div ref={formRef}>
                <FollowupCreateForm
                  key={replacement?.id ?? "new"}
                  studentId={studentId}
                  replacement={replacement}
                  onSaved={refresh}
                  onCancelReplacement={() => setReplacement(null)}
                />
              </div>
              {items.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                  {t("followup_history_empty")}
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {items.map((item) => (
                    <li key={item.id}>
                      <FollowupHistoryItem
                        studentId={studentId}
                        item={item}
                        onChanged={refresh}
                        onReplace={replace}
                        onError={handleError}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {items.length < total ? (
                <Button variant="secondary" busy={loadingMore} onClick={() => void loadMore()}>
                  {t("followup_load_more")}
                </Button>
              ) : null}
            </div>
          )
        }
        className="flex flex-col gap-4"
      >
        <Skeleton className="h-72 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-48 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    </section>
  );
}
