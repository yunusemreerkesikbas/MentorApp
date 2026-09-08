"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";
import { Card, Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { fetchNotebookEntries } from "@/lib/notebook";
import { listNotebookEntriesQuerySchema } from "@mentor/validation";
import { NotebookReviewPanel } from "./notebook-review-panel";

export function NotebookFocusReview() {
  const params = useSearchParams();
  const t = useTranslations("notebook.focusReview");
  const [result, setResult] = useState<{
    key: string;
    items: NotebookEntryDto[];
    hasMore: boolean;
  } | null>(null);
  const [early, setEarly] = useState(false);
  const [closed, setClosed] = useState(false);
  const [errorKey, setFailed] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const search = params.toString();
  const loadKey = search + ":" + early + ":" + retry + ":" + page;
  const entries = result?.key === loadKey ? result.items : null;
  const hasMore = result?.key === loadKey && result.hasMore;
  const failed = errorKey === loadKey;
  useEffect(() => {
    let active = true;
    async function loadEntries() {
      const values = new URLSearchParams(search);
      const query = listNotebookEntriesQuerySchema.parse({
        examId: values.get("examId") ?? undefined,
        subjectRef: values.get("subjectRef") ?? undefined,
        topicRef: values.get("topicRef") ?? undefined,
        errorType: values.get("errorType") ?? undefined,
        status: values.has("entryId") ? undefined : "ACTIVE",
        revisit: values.get("revisit") ?? undefined,
        days: values.get("days") ?? undefined,
        due:
          early || values.has("entryId") || values.has("revisit")
            ? undefined
            : "true",
        sort: early ? "created" : "review",
        page,
        pageSize: 20,
      });
      // Entry-specific history links use the same owned-record endpoint.
      const load = values.has("entryId")
        ? import("@mentor/api-client")
            .then(({ http }) =>
              http<NotebookEntryDto>(
                "/v1/coaching/notebook/entries/" +
                  encodeURIComponent(values.get("entryId")!),
              ),
            )
            .then((item) => ({ items: [item], total: 1 }))
        : fetchNotebookEntries(query);
      const loaded = await load;
      if (active)
        setResult({
          key: loadKey,
          items: loaded.items,
          hasMore: loaded.total > page * 20,
        });
    }
    void loadEntries().catch(() => {
      if (active) setFailed(loadKey);
    });
    return () => {
      active = false;
    };
  }, [search, early, loadKey, page]);
  const back = {
    pathname: "/analysis" as const,
    query: {
      tab: "progress",
      focus:
        params.get("focus") ??
        [params.get("subjectRef") ?? "", params.get("topicRef") ?? ""].join(
          "|",
        ),
      days: params.get("days") === "30" ? "30" : "7",
    },
  };
  return (
    <div className="p-4">
      <Link className="inline-flex min-h-11 items-center underline" href={back}>
        {t("back")}
      </Link>
      {failed ? (
        <Card>
          <p role="alert">{t("error")}</p>
          <Button onClick={() => setRetry((r) => r + 1)}>{t("retry")}</Button>
        </Card>
      ) : !entries ? (
        <Card>
          <p role="status">{t("loading")}</p>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <p>{t(early ? "empty" : "noDue")}</p>
          {!early && (
            <Button onClick={() => setEarly(true)}>{t("early")}</Button>
          )}
        </Card>
      ) : closed ? (
        <Card>
          <p>{t("saved")}</p>
          {hasMore && (
            <Button
              onClick={() => {
                setClosed(false);
                setPage(early ? page + 1 : 1);
                setRetry((r) => r + 1);
              }}
            >
              {t("more")}
            </Button>
          )}
        </Card>
      ) : (
        <NotebookReviewPanel
          key={search + early + retry + page}
          entries={entries}
          onReviewed={() => {}}
          onClose={() => setClosed(true)}
        />
      )}
    </div>
  );
}
