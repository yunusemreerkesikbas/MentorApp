"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AltArrowLeftIcon } from "@solar-icons/react/linear/alt-arrow-left";
import type { NotebookEntryDto } from "@mentor/types";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import type { PuhuVariant } from "@/components/puhu-image";
import { Link, useRouter } from "@/i18n/navigation";
import { fetchNotebookEntries } from "@/lib/notebook";
import { listNotebookEntriesQuerySchema } from "@mentor/validation";
import { NotebookReviewPanel } from "./notebook-review-panel";

/** One state of the page: Puhu, a title, a line and up to two actions, centred in the column. */
function FocusState({
  puhu,
  title,
  description,
  alert,
  children,
}: {
  puhu?: PuhuVariant;
  title: string;
  description?: string;
  alert?: boolean;
  children?: ReactNode;
}) {
  return (
    <div role={alert ? "alert" : undefined}>
      <EmptyState
        puhuVariant={puhu}
        title={title}
        description={description}
        action={children ? <div className="flex flex-col gap-2">{children}</div> : undefined}
      />
    </div>
  );
}

/** Mirrors FocusState while the entries load (DESIGN.md §1 rule 7). */
function FocusStateSkeleton({ label }: { label: string }) {
  return (
    <SkeletonGroup label={label} className="flex flex-col items-center gap-4 px-5 py-8">
      <Skeleton className="size-28 rounded-full" />
      <Skeleton className="h-6 w-48 rounded-[var(--radius-card)]" />
      <Skeleton className="h-4 w-64 rounded-[var(--radius-card)]" />
      <Skeleton className="mt-1 h-12 w-full max-w-xs rounded-[var(--radius-card)]" />
    </SkeletonGroup>
  );
}

export function NotebookFocusReview() {
  const params = useSearchParams();
  const router = useRouter();
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
  // Back to the analysis view the review was opened from: the Gelişim hero marks its links
  // `from=progress`; everything else starts on Yanlışlarım.
  const back = {
    pathname: "/analysis" as const,
    query: { tab: params.get("from") === "progress" ? "progress" : "mistakes" },
  };
  const openNotebook = (
    <Button fullWidth variant="secondary" onClick={() => router.push("/notebook")}>
      {t("notebook")}
    </Button>
  );
  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col px-4 py-4">
      <Link
        className="inline-flex min-h-11 items-center gap-1 self-start rounded-[var(--radius-card)] text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-secondary)" }}
        href={back}
      >
        <AltArrowLeftIcon size={18} aria-hidden />
        {t("back")}
      </Link>
      {/* The review deck opens as an overlay; this column is what stays behind it and after it. */}
      <div className="flex flex-1 flex-col justify-center pb-16">
        {failed ? (
          <FocusState title={t("error")} alert>
            <Button fullWidth onClick={() => setRetry((r) => r + 1)}>
              {t("retry")}
            </Button>
          </FocusState>
        ) : !entries ? (
          <FocusStateSkeleton label={t("loading")} />
        ) : entries.length === 0 ? (
          <FocusState
            puhu={early ? "encouraging" : "happy"}
            title={t(early ? "empty_title" : "noDue_title")}
            description={t(early ? "empty" : "noDue")}
          >
            {!early ? (
              <Button fullWidth onClick={() => setEarly(true)}>
                {t("early")}
              </Button>
            ) : null}
            {openNotebook}
          </FocusState>
        ) : closed ? (
          <FocusState puhu="proud" title={t("saved_title")} description={t("saved")}>
            {hasMore ? (
              <Button
                fullWidth
                onClick={() => {
                  setClosed(false);
                  setPage(early ? page + 1 : 1);
                  setRetry((r) => r + 1);
                }}
              >
                {t("more")}
              </Button>
            ) : null}
            {openNotebook}
          </FocusState>
        ) : (
          <NotebookReviewPanel
            key={search + early + retry + page}
            entries={entries}
            onReviewed={() => {}}
            onClose={() => setClosed(true)}
          />
        )}
      </div>
    </div>
  );
}
