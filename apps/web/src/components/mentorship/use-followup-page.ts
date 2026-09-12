"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import type { Paginated } from "@mentor/types";
import { fetchFollowupAvailability } from "@/lib/mentorship-followups";
type Result<T> = { key: object | null; enabled: boolean | null; data: Paginated<T> | null; error: string | null };
/** Only the current request's result is visible. Aborted reads cannot restore private data. */
export function useFollowupPage<T>(load: (page: number, signal: AbortSignal) => Promise<Paginated<T>>) {
  const common = useTranslations("common");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const key = useMemo(() => ({ load, page, revision }), [load, page, revision]);
  const [result, setResult] = useState<Result<T>>({ key: null, enabled: null, data: null, error: null });
  const showError = useCallback((failure: unknown) => {
    setResult((current) => ({ ...current, error: failure instanceof ApiClientError ? failure.message : common("error_unknown") }));
  }, [common]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    void fetchFollowupAvailability(controller.signal).then(async (availability) => {
      if (controller.signal.aborted) return;
      if (!availability.enabled) { setResult({ key, enabled: false, data: null, error: null }); return; }
      const data = await load(page, controller.signal);
      if (!controller.signal.aborted) {
        if (page > 1 && data.items.length === 0) setPage(1);
        else setResult({ key, enabled: true, data, error: null });
      }
    }).catch((failure: unknown) => {
      if (controller.signal.aborted) return;
      const disabled = failure instanceof ApiClientError && failure.body.code === "MENTORSHIP_FOLLOWUP_DISABLED";
      setResult({ key, enabled: disabled ? false : true, data: null, error: disabled ? null : failure instanceof ApiClientError ? failure.message : common("error_unknown") });
    });
    return () => controller.abort();
  }, [load, page, key, common]);
  const loading = result.key !== key;
  return { enabled: result.enabled, data: loading ? null : result.data, page, setPage, loading, error: loading ? null : result.error, showError, reload };
}
