"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  AuthUser,
  ExamCalendarDto,
  ExamSubjectDto,
  NotebookDto,
  NotebookSummaryDto,
} from "@mentor/types";
import {
  contentControllerCalendarByFamily,
  contentControllerSubjectsBySlug,
  usersControllerMe,
} from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { NotebookCover } from "@/components/notebook/notebook-surface";
import { Link, useRouter } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { deleteNotebook, fetchNotebooks } from "@/lib/notebook";
import { NotebookFormDialog } from "./notebook-form-dialog";

interface ExamChoice {
  id: string;
  subjects: ExamSubjectDto[];
}

export function NotebooksShell() {
  const t = useTranslations("notebooks");
  const notebookT = useTranslations("notebook");
  const router = useRouter();
  const { confirm } = useMentorDialog();
  const [items, setItems] = useState<NotebookSummaryDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [error, setError] = useState(false);
  const [failedDelete, setFailedDelete] = useState<NotebookSummaryDto | null>(null);
  const [deleteSyncError, setDeleteSyncError] = useState(false);
  const [form, setForm] = useState<NotebookSummaryDto | "new" | null>(null);
  const [exam, setExam] = useState<ExamChoice | null>(null);

  async function loadFirst() {
    setLoading(true);
    setError(false);
    try {
      const result = await fetchNotebooks(1);
      setItems(result.items);
      setTotal(result.total);
      setPage(1);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchNotebooks(1)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
        setPage(1);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    usersControllerMe()
      .then(async (raw) => {
        const user = raw as unknown as AuthUser;
        if (!user.examType) return null;
        const calendar = (await contentControllerCalendarByFamily(
          user.examType,
        )) as unknown as ExamCalendarDto | null;
        if (!calendar?.exam) return null;
        const subjects = (await contentControllerSubjectsBySlug(
          calendar.exam.slug,
        )) as unknown as ExamSubjectDto[];
        return { id: calendar.exam.id, subjects };
      })
      .then((value) => {
        if (active) setExam(value);
      })
      .catch(() => {
        if (active) setExam(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const nextPage = page + 1;
      const result = await fetchNotebooks(nextPage);
      setItems((current) => [...current, ...result.items]);
      setPage(nextPage);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(item: NotebookSummaryDto) {
    setFailedDelete(null);
    setDeleteSyncError(false);
    const accepted = await confirm({
      title: t("delete_title", { title: item.title ?? "" }),
      message: t("delete_message"),
      confirmLabel: t("delete_confirm"),
      cancelLabel: t("cancel"),
    });
    if (!accepted) return;
    try {
      await deleteNotebook(item.id);
    } catch {
      setFailedDelete(item);
      return;
    }

    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    setTotal((current) => Math.max(0, current - 1));
    await resyncAfterDelete();
  }

  async function resyncAfterDelete() {
    setDeleteSyncError(false);
    try {
      const result = await fetchNotebooks(1);
      setItems(result.items);
      setTotal(result.total);
      setPage(1);
    } catch {
      setDeleteSyncError(true);
    }
  }

  async function handleSaved(
    saved: NotebookDto,
    wasFirstCustom: boolean,
  ): Promise<void> {
    setForm(null);
    if (wasFirstCustom) {
      router.push({
        pathname: "/notebooks/[notebookId]",
        params: { notebookId: saved.id },
      });
      return;
    }
    await loadFirst();
  }

  const customCount = items.filter((item) => item.kind === "CUSTOM").length;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-main)]">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-secondary)]">
            {t("subtitle")}
          </p>
        </div>
        <Button type="button" onClick={() => setForm("new")}>
          <Plus aria-hidden size={18} />
          {t("create")}
        </Button>
      </header>

      {loading ? <NotebookGridSkeleton /> : null}
      {!loading && error ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-[var(--color-secondary)]">{t("error")}</p>
          <button
            type="button"
            onClick={() => void loadFirst()}
            className="mt-4 min-h-11 rounded-[var(--radius-button)] bg-[var(--color-btn)] px-5 font-semibold text-[var(--color-btn-label)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {t("retry")}
          </button>
        </div>
      ) : null}
      {!loading && !error ? (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => (
              <NotebookCard
                key={item.id}
                item={item}
                systemTitle={notebookT("cover_title")}
                onEdit={() => setForm(item)}
                onDelete={() => void remove(item)}
              />
            ))}
          </div>
          {failedDelete ? (
            <div
              role="alert"
              className="mx-auto flex flex-wrap items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-secondary)]"
            >
              <span>{t("delete_error", { title: failedDelete.title ?? "" })}</span>
              <button
                type="button"
                onClick={() => void remove(failedDelete)}
                className="min-h-11 rounded-[var(--radius-button)] border border-[var(--color-border)] px-4 font-semibold text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                {t("retry")}
              </button>
            </div>
          ) : null}
          {deleteSyncError ? (
            <div
              role="alert"
              className="mx-auto flex flex-wrap items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-secondary)]"
            >
              <span>{t("delete_sync_error")}</span>
              <button
                type="button"
                onClick={() => void resyncAfterDelete()}
                className="min-h-11 rounded-[var(--radius-button)] border border-[var(--color-border)] px-4 font-semibold text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                {t("retry")}
              </button>
            </div>
          ) : null}
          {loadMoreError ? (
            <div
              role="alert"
              className="mx-auto flex flex-wrap items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-secondary)]"
            >
              <span>{t("load_more_error")}</span>
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="min-h-11 rounded-[var(--radius-button)] border border-[var(--color-border)] px-4 font-semibold text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
              >
                {t("retry")}
              </button>
            </div>
          ) : items.length < total ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="mx-auto inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 font-semibold text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
            >
              {loadingMore ? (
                <LoaderCircle
                  aria-hidden
                  className="animate-spin motion-reduce:animate-none"
                  size={18}
                />
              ) : null}
              {t("load_more")}
            </button>
          ) : null}
        </>
      ) : null}

      {form ? (
        <NotebookFormDialog
          current={form === "new" ? null : form}
          exam={exam}
          onClose={() => setForm(null)}
          onSaved={(saved) =>
            void handleSaved(
              saved,
              form === "new" && customCount === 0,
            )
          }
        />
      ) : null}
    </main>
  );
}

function NotebookCard({
  item,
  systemTitle,
  onEdit,
  onDelete,
}: {
  item: NotebookSummaryDto;
  systemTitle: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("notebooks");
  const title = item.title ?? systemTitle;
  const href =
    item.kind === "MISTAKE"
      ? ("/notebook" as const)
      : ({
          pathname: "/notebooks/[notebookId]" as const,
          params: { notebookId: item.id },
        } as const);
  return (
    <article className="group relative rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      {item.kind === "CUSTOM" ? (
        <div className="absolute end-2 top-2 z-10 flex rounded-full bg-[var(--color-surface)] opacity-100 shadow-[var(--shadow-card)] transition-opacity duration-150 motion-reduce:transition-none [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100">
          <button
            type="button"
            aria-label={t("edit", { title })}
            onClick={onEdit}
            className="flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <Pencil aria-hidden size={18} />
          </button>
          <button
            type="button"
            aria-label={t("delete", { title })}
            onClick={onDelete}
            className="flex size-11 items-center justify-center rounded-full text-[var(--color-danger)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <Trash2 aria-hidden size={18} />
          </button>
        </div>
      ) : null}
      <Link
        href={href}
        className="block rounded-[var(--radius-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        <div className="mx-auto aspect-[3/4] w-full max-w-64 overflow-hidden rounded-[var(--radius-card)]">
          <NotebookCover title={title} cover={item.cover} />
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-bold text-[var(--color-main)]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-secondary)]">
              {t("pages", { count: item.pageCount })}
            </p>
          </div>
          {item.subjectName ? (
            <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--color-main)]">
              {item.subjectName}
            </span>
          ) : null}
        </div>
        {item.kind === "MISTAKE" ? (
          <p className="mt-3 text-sm font-semibold text-[var(--color-secondary)]">
            {t("due", { count: item.dueCount })}
          </p>
        ) : null}
      </Link>
    </article>
  );
}

function NotebookGridSkeleton() {
  return (
    <div
      aria-hidden
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <div
          key={index}
          className="mentor-skeleton-shimmer rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <div className="mx-auto aspect-[3/4] w-full max-w-64 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
          <div className="mt-4 h-5 w-2/3 rounded bg-[var(--color-surface-alt)]" />
          <div className="mt-2 h-4 w-1/3 rounded bg-[var(--color-surface-alt)]" />
        </div>
      ))}
    </div>
  );
}
