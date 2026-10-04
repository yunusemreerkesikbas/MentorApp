"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { LoaderCircle } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type {
  ExamSubjectDto,
  NotebookDto,
  NotebookSummaryDto,
} from "@mentor/types";
import { loadViewerExamTaxonomy } from "@/lib/exam-taxonomy";
import { useRouter } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { deleteNotebook, fetchNotebooks } from "@/lib/notebook";
import { notebookOpening, useNotebookOpening } from "@/lib/notebook-opening";
import { playNotebookSfx } from "@/lib/notebook-sfx";
import { prefetchNotebookContents } from "@/lib/notebook-contents-cache";
import { preloadNotebookOpeningFlight } from "@/components/notebook-desk/notebook-opening-overlay";
import { useTheme } from "@/lib/use-theme";
import { NotebookFormDialog } from "./notebook-form-dialog";
import { DeskBackdrop, DeskLight } from "@/components/notebook-desk/desk-backdrop";
import { DeskHeader } from "./desk-header";
import { DeskLamp } from "./desk-lamp";
import { DeskPuhu } from "./desk-puhu";
import { DeskMug, DeskPencil, DeskPlant } from "./desk-props";
import { DeskNotebook, deskBookPose, notebookHref } from "./desk-notebook";
import { DeskPackage } from "./desk-package";
import { DeskSkeletonBooks } from "./desk-skeleton";
import { DeskNotice } from "./desk-notice";
import { useDeskFrames, useDeskLight } from "./use-desk-light";

interface ExamChoice {
  id: string;
  subjects: ExamSubjectDto[];
}

/** How long a freshly made notebook takes to fall and settle, and when it touches the wood. */
const DROP_MS = 1400;
const DROP_LAND_MS = 560;

/**
 * The screen the editor will have for the book: this page's own column, from the top of the
 * window down, less the phone's top bar and tab pill (`MOBILE_TAB_BAR_PADDING_CLASS`).
 */
function pageArea(scene: HTMLElement | null) {
  const phone = window.matchMedia("(max-width: 1023px)").matches;
  const top = phone ? 64 : 0;
  const bottom = phone ? 80 : 0;
  const box = scene?.getBoundingClientRect();
  return {
    x: box?.left ?? 0,
    y: top,
    width: box?.width ?? window.innerWidth,
    height: window.innerHeight - top - bottom,
  };
}

/** The key the editor knows a notebook by: the mistake notebook lives at its own route. */
export function openingKey(item: NotebookSummaryDto): string {
  return item.kind === "MISTAKE" ? "mistake" : item.id;
}

/**
 * Defterlerim: the student's notebooks lying on a desk.
 *
 * This component owns the data and the desk's state; the room, the books and the props are drawn
 * by their own components, and the moment a book is lifted off the desk and opened belongs to the
 * overlay in the app shell (`notebook-opening-overlay.tsx`), because it outlives this page.
 */
export function NotebooksShell() {
  const t = useTranslations("notebooks");
  const notebookT = useTranslations("notebook");
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const { theme } = useTheme();
  const { confirm } = useMentorDialog();
  const opening = useNotebookOpening();
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [packageActive, setPackageActive] = useState(false);
  const [droppingId, setDroppingId] = useState<string | null>(null);

  const sceneRef = useRef<HTMLElement | null>(null);
  const lampRef = useRef<SVGSVGElement | null>(null);
  const puhuRef = useRef<HTMLElement | null>(null);
  const { frames, register } = useDeskFrames();
  const dropTimers = useRef<number[]>([]);

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

  // The flight is its own chunk (see the overlay); fetched now, it is here before any book is clicked.
  useEffect(() => {
    preloadNotebookOpeningFlight();
  }, []);

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
    loadViewerExamTaxonomy()
      .then((bundle) => {
        if (!bundle.exam) return null;
        return { id: bundle.exam.id, subjects: bundle.subjects };
      })
      .then((value) => {
        if (active) setExam(value);
      })
      .catch(() => {
        if (active) setExam(null);
      });
    const timers = dropTimers.current;
    return () => {
      active = false;
      for (const timer of timers) window.clearTimeout(timer);
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

  /** A new notebook falls onto the desk, lands with a thud and a little dust; Puhu waves. */
  function drop(id: string) {
    // Changed in place: the unmount cleanup holds this array, and must see the timers set here.
    const timers = dropTimers.current;
    for (const timer of timers.splice(0)) window.clearTimeout(timer);
    setDroppingId(id);
    timers.push(
      window.setTimeout(() => playNotebookSfx("land"), DROP_LAND_MS),
      window.setTimeout(() => setDroppingId(null), DROP_MS),
    );
  }

  async function handleSaved(
    saved: NotebookDto,
    created: boolean,
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
    if (created && !reduceMotion) drop(saved.id);
  }

  function handleOpen(
    event: ReactMouseEvent<HTMLAnchorElement>,
    item: NotebookSummaryDto,
  ) {
    // Anything but a plain primary click keeps its browser meaning: a new tab, a new window.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (opening.start) return;
    const frame = frames.current.get(item.id);
    const box = frame?.getBoundingClientRect();
    const title = item.title ?? notebookT("cover_title");
    const lifted = activeId === item.id;
    prefetchNotebookContents(item.kind === "MISTAKE" ? undefined : item.id);
    notebookOpening.begin({
      book: {
        key: openingKey(item),
        kind: item.kind,
        title,
        cover: item.cover,
        pageCount: item.pageCount,
        dueCount: item.dueCount,
        subject:
          item.kind === "CUSTOM" && item.subjectName
            ? { key: item.subjectRef ?? item.subjectName, name: item.subjectName }
            : null,
        meta: t("pages", { count: item.pageCount }),
        dueLabel:
          item.kind === "MISTAKE" && item.dueCount > 0
            ? t("due", { count: item.dueCount })
            : null,
      },
      from: box
        ? { x: box.left, y: box.top, width: box.width, height: box.height }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2, width: 0, height: 0 },
      area: pageArea(sceneRef.current),
      pose: { ...deskBookPose(item, lifted), lifted },
      navigate: () => router.push(notebookHref(item)),
    });
  }

  const customCount = items.filter((item) => item.kind === "CUSTOM").length;
  const mistake = items.find((item) => item.kind === "MISTAKE") ?? null;
  // The copy flies in its place; under reduced motion there is no copy, so the book stays put.
  const awayKey = opening.underway && !reduceMotion ? (opening.start?.book.key ?? null) : null;
  const litId = activeId ?? mistake?.id ?? items[0]?.id ?? null;
  useDeskLight({
    sceneRef,
    lampRef,
    puhuRef,
    frames,
    targets: { litId, activeId },
    layoutKey: `${loading}:${items.map((item) => item.id).join(",")}`,
  });

  const bubble = droppingId
    ? t("desk.bubble_new")
    : mistake && mistake.dueCount > 0
      ? t("desk.bubble_due", {
          count: mistake.dueCount,
          time: theme === "dark" ? "night" : "day",
        })
      : customCount === 0
        ? t("desk.bubble_first")
        : t("desk.bubble_idle");

  return (
    <main
      ref={sceneRef}
      className="mentor-notebook-desk desk-scene min-h-[100dvh] overflow-hidden"
    >
      <DeskBackdrop />
      <div className="desk-content relative mx-auto w-full max-w-[1360px] px-4 pb-20 sm:px-6 lg:px-10">
        <DeskHeader />

        <DeskPuhu
          className="desk-puhu-spot"
          waving={droppingId !== null}
          reduceMotion={reduceMotion}
          onElement={(element) => {
            puhuRef.current = element;
          }}
        />
        {!loading && !error ? (
          <p className="desk-bubble desk-bubble-spot" role="status">
            {bubble}
          </p>
        ) : null}
        <DeskLamp
          lampRef={(element) => {
            lampRef.current = element;
          }}
          className="desk-prop desk-lamp-spot"
        />
        <DeskPlant className="desk-plant-spot" />
        <DeskMug className="desk-mug-spot" />
        <DeskPencil className="desk-pencil-spot" />

        <section aria-label={t("title")} className="desk-grid">
          {loading ? <DeskSkeletonBooks /> : null}
          {!loading && !error
            ? items.map((item) => {
                const title = item.title ?? notebookT("cover_title");
                return (
                  <DeskNotebook
                    key={item.id}
                    item={item}
                    title={title}
                    lifted={activeId === item.id}
                    dropping={droppingId === item.id}
                    away={awayKey === openingKey(item)}
                    frameRef={register(item.id)}
                    onActive={(id) => setActiveId(id)}
                    onOpen={handleOpen}
                    onEdit={() => setForm(item)}
                    onDelete={() => void remove(item)}
                  />
                );
              })
            : null}
          {!loading ? (
            <DeskPackage
              label={t("create")}
              lifted={packageActive}
              onActive={setPackageActive}
              onOpen={() => setForm("new")}
            />
          ) : null}
        </section>

        <div className="relative z-[5] mt-8 flex flex-col items-center gap-3">
          {!loading && error ? (
            <DeskNotice message={t("error")} actionLabel={t("retry")} onAction={() => void loadFirst()} />
          ) : null}
          {failedDelete ? (
            <DeskNotice
              alert
              message={t("delete_error", { title: failedDelete.title ?? "" })}
              actionLabel={t("retry")}
              onAction={() => void remove(failedDelete)}
            />
          ) : null}
          {deleteSyncError ? (
            <DeskNotice
              alert
              message={t("delete_sync_error")}
              actionLabel={t("retry")}
              onAction={() => void resyncAfterDelete()}
            />
          ) : null}
          {loadMoreError ? (
            <DeskNotice
              alert
              message={t("load_more_error")}
              actionLabel={t("retry")}
              disabled={loadingMore}
              onAction={() => void loadMore()}
            />
          ) : !loading && !error && items.length < total ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="desk-more inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
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
        </div>
      </div>
      <DeskLight />

      {form ? (
        <NotebookFormDialog
          current={form === "new" ? null : form}
          exam={exam}
          onClose={() => setForm(null)}
          onSaved={(saved) =>
            void handleSaved(saved, form === "new", form === "new" && customCount === 0)
          }
        />
      ) : null}
    </main>
  );
}
