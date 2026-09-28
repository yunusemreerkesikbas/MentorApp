"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import type { Paginated } from "@mentor/types";
import { fetchFollowupAvailability } from "@/lib/mentorship-followups";
import { NOTIFICATION_ARRIVED } from "@/lib/notification-events";
type Result<T> = {
  /** The list and page this result answers; a reload of the same view keeps it on screen. */
  view: object | null;
  enabled: boolean | null;
  data: Paginated<T> | null;
  error: string | null;
};
/** Only the current request's result is visible. Aborted reads cannot restore private data. */
export function useFollowupPage<T>(
  load: (page: number, signal: AbortSignal) => Promise<Paginated<T>>,
) {
  const common = useTranslations("common");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const view = useMemo(() => ({ load, page }), [load, page]);
  const key = useMemo(() => ({ view, revision }), [view, revision]);
  const [result, setResult] = useState<Result<T>>({
    view: null,
    enabled: null,
    data: null,
    error: null,
  });
  const showError = useCallback(
    (failure: unknown) => {
      setResult((current) => ({
        ...current,
        error:
          failure instanceof ApiClientError
            ? failure.message
            : common("error_unknown"),
      }));
    },
    [common],
  );
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  // The other side can decide or answer while this screen is open: read again when a notification
  // arrives or the tab comes back. Silent, because the current list stays until the new one lands.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener(NOTIFICATION_ARRIVED, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener(NOTIFICATION_ARRIVED, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchFollowupAvailability(controller.signal)
      .then(async (availability) => {
        if (controller.signal.aborted) return;
        if (!availability.enabled) {
          setResult({ view: key.view, enabled: false, data: null, error: null });
          return;
        }
        const data = await load(page, controller.signal);
        if (!controller.signal.aborted) {
          if (page > 1 && data.items.length === 0) setPage(1);
          else setResult({ view: key.view, enabled: true, data, error: null });
        }
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        const disabled =
          failure instanceof ApiClientError &&
          failure.body.code === "MENTORSHIP_FOLLOWUP_DISABLED";
        setResult({
          view: key.view,
          enabled: disabled ? false : true,
          data: null,
          error: disabled
            ? null
            : failure instanceof ApiClientError
              ? failure.message
              : common("error_unknown"),
        });
      });
    return () => controller.abort();
  }, [load, page, key, common]);
  const loading = result.view !== view;
  return {
    enabled: result.enabled,
    data: loading ? null : result.data,
    page,
    setPage,
    loading,
    error: loading ? null : result.error,
    showError,
    reload,
  };
}
