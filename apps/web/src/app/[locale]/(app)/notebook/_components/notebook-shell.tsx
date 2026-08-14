"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type {
  ExamCalendarDto,
  ExamSubjectDto,
  NotebookEntryDto,
  NotebookOverviewDto,
  NotebookPageDoc,
  NotebookPageDto,
} from "@mentor/types";
import { NOTEBOOK_PAGE_CANVAS, type NotebookPaper, type NotebookPageItem, type VisionSticker } from "@mentor/types";
import {
  contentControllerCalendarByFamily,
  contentControllerSubjectsBySlug,
  usersControllerMe,
} from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
import { Button, Chip } from "@mentor/ui";
import { FormError } from "@/components/form";
import {
  NotebookCover,
  NotebookPageSurface,
} from "@/components/notebook/notebook-surface";
import { NotebookPageStage } from "@/components/notebook/notebook-page-stage";
import {
  fetchDueEntries,
  fetchNotebookOverview,
  fetchNotebookPage,
  saveNotebookPage,
} from "@/lib/notebook";
import { createNoteItem, createStickerItem, nextEntrySlot } from "@/lib/notebook-layout";
import { useItemGesture } from "@/components/stage/use-item-gesture";
import { SelectionOverlay } from "@/components/stage/selection-overlay";
import { NotebookEditBar } from "./notebook-edit-bar";
import { useNotebookPage } from "./use-notebook-page";
import { NotebookAddPanel } from "./notebook-add-panel";
import { NotebookContentSkeleton } from "./notebook-content-skeleton";
import { NotebookReviewPanel } from "./notebook-review-panel";

/** How far a drag has to travel before it counts as turning the page rather than a stray swipe. */
const TURN_THRESHOLD_PX = 60;

type View = { kind: "cover" } | { kind: "page"; index: number };

/** Matches the server's blank page, so an unsaved page and a fetched empty one render alike. */
const EMPTY_PAGE: NotebookPageDoc = { version: 1, paper: "ruled", items: [] };

/** Long enough that a drag settles first, short enough that a closed tab loses nothing. */
const AUTOSAVE_DELAY_MS = 900;

interface ExamContext {
  id: string;
  subjects: ExamSubjectDto[];
}

/**
 * The notebook shell: a cover that opens into pages you turn.
 *
 * The cover is not decoration — it is what makes this "my notebook" rather than a list screen, and
 * the strip on it is what brings the user back. Both halves are load-bearing: the wall gives them
 * something to own, the strip gives them a reason to return (see the plan's option C).
 */
export function NotebookShell() {
  const t = useTranslations("notebook");
  const reduceMotion = useReducedMotion();

  const [view, setView] = useState<View>({ kind: "cover" });
  const [overview, setOverview] = useState<NotebookOverviewDto | null>(null);
  const [exam, setExam] = useState<ExamContext | null>(null);
  const [page, setPage] = useState<NotebookPageDto | null>(null);
  const [editing, setEditing] = useState(false);
  const {
    state: pageState,
    dispatch: pageDispatch,
    patch,
    checkpoint,
    selected,
    canUndo,
  } = useNotebookPage(EMPTY_PAGE);
  const gesture = useItemGesture<NotebookPageItem>({
    patch,
    checkpoint,
    lockRatioFor: (item) => item.kind === "sticker",
    canvasWidth: NOTEBOOK_PAGE_CANVAS.width,
  });
  const [due, setDue] = useState<NotebookEntryDto[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** +1 turning forward, -1 turning back — decides which way the leaf swings. */
  const [direction, setDirection] = useState(1);

  /*
   * Overview, due list and exam taxonomy load together rather than in sequence: none of them needs
   * another's answer, and chaining them would stack three round-trips before the cover appears.
   */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [overviewResult, dueResult, examResult] = await Promise.allSettled([
        fetchNotebookOverview(),
        fetchDueEntries(),
        (async (): Promise<ExamContext | null> => {
          const me = (await usersControllerMe()) as unknown as AuthUser;
          if (!me.examType) return null;
          const calendar = (await contentControllerCalendarByFamily(
            me.examType,
          )) as unknown as ExamCalendarDto | null;
          const current = calendar?.exam ?? null;
          if (!current) return null;
          const subjects = (await contentControllerSubjectsBySlug(
            current.slug,
          )) as unknown as ExamSubjectDto[];
          return { id: current.id, subjects };
        })(),
      ]);
      if (cancelled) return;

      if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
      else setError(t("error_load"));

      if (dueResult.status === "fulfilled") {
        setDue(dueResult.value);
        // The push notification deep-links here; landing on the cover and making the user hunt for
        // the strip would waste the one moment they actually came back for.
        if (
          dueResult.value.length > 0 &&
          new URLSearchParams(window.location.search).get("review") === "due"
        ) {
          setReviewing(true);
        }
      }
      // A missing exam only disables *adding*, so it is not an error banner — the user can still
      // read the notebook they already have.
      if (examResult.status === "fulfilled") setExam(examResult.value);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (view.kind !== "page") return;
    let cancelled = false;
    fetchNotebookPage(view.index)
      .then((data) => {
        if (cancelled) return;
        setPage(data);
        pageDispatch({ type: "replace", doc: data.doc });
      })
      .catch(() => {
        if (!cancelled) setError(t("error_load"));
      });
    return () => {
      cancelled = true;
    };
  }, [view, t, pageDispatch]);

  /*
   * Autosave rather than a save button: the user came here to review, and a page that silently
   * loses a dragged sticker because they navigated away is worse than any save affordance.
   */
  useEffect(() => {
    if (view.kind !== "page" || !pageState.dirty) return;
    const index = view.index;
    const doc = pageState.doc;
    const timer = setTimeout(() => {
      saveNotebookPage(index, doc)
        .then(() => pageDispatch({ type: "saved" }))
        .catch(() => setError(t("error_place")));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pageState.dirty, pageState.doc, view, pageDispatch, t]);

  /**
   * Turning back from page 0 closes the book rather than doing nothing. A notebook that traps you
   * past its cover reads as broken, and "no visible response" is the worst answer to a swipe.
   */
  const turn = useCallback((delta: number) => {
    setDirection(delta);
    setAdding(false);
    setView((current) => {
      if (current.kind === "cover") {
        return delta > 0 ? { kind: "page", index: 0 } : current;
      }
      const next = current.index + delta;
      if (next < 0) return { kind: "cover" };
      return { kind: "page", index: next };
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") turn(1);
      if (event.key === "ArrowLeft") turn(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  /**
   * Place a freshly saved entry on the open page.
   *
   * The entry row already exists at this point — the page save only records where its card sits.
   * If that save fails the mistake is still in the book, so the banner says "we could not place
   * it", not "we lost it".
   */
  /**
   * Place a freshly saved entry on the open page.
   *
   * The entry row already exists at this point — placing it only records where its card sits, and
   * the autosave effect persists that. If the page is full we say so rather than stacking a card
   * off the bottom edge where nobody would find it.
   */
  const handleCreated = useCallback(
    (entry: NotebookEntryDto) => {
      const slot = nextEntrySlot(pageState.doc.items);
      if (!slot) {
        setError(t("error_page_full"));
        setAdding(false);
        return;
      }
      pageDispatch({
        type: "add",
        item: { ...slot, id: crypto.randomUUID(), kind: "entry", entryId: entry.id, opacity: 1 },
      });
      setPage((current) =>
        current ? { ...current, entries: [...current.entries, entry] } : current,
      );
      setAdding(false);
    },
    [pageState.doc.items, pageDispatch, t],
  );

  /**
   * A reviewed entry is patched in place rather than refetched: the open page already holds the
   * card, and the server's answer is the whole new state of it. This is what makes a healed card
   * fade on the wall the moment it heals.
   */
  const handleReviewed = useCallback((updated: NotebookEntryDto) => {
    setDue((current) => current.filter((entry) => entry.id !== updated.id));
    setPage((current) =>
      current
        ? {
            ...current,
            entries: current.entries.map((entry) =>
              entry.id === updated.id ? updated : entry,
            ),
          }
        : current,
    );
    setOverview((current) =>
      current
        ? {
            ...current,
            dueCount: Math.max(0, current.dueCount - 1),
            healedCount:
              updated.status === "HEALED"
                ? current.healedCount + 1
                : current.healedCount,
          }
        : current,
    );
  }, []);

  if (!overview && !error) return <NotebookContentSkeleton />;

  const dueIds = new Set(due.map((entry) => entry.id));

  const key = view.kind === "cover" ? "cover" : `page-${view.index}`;

  return (
    <div className="flex flex-col gap-4">
      <FormError message={error} />

      {/* The strip: the whole reason the notebook is a habit and not an archive. */}
      {overview && overview.dueCount > 0 ? (
        <button
          type="button"
          onClick={() => setReviewing(true)}
          className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ backgroundColor: "var(--color-accent-soft)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
            {t("due_strip", { count: overview.dueCount })}
          </span>
          <Chip>{overview.dueCount}</Chip>
        </button>
      ) : null}

      {reviewing ? (
        <NotebookReviewPanel
          entries={due}
          onReviewed={handleReviewed}
          onClose={() => setReviewing(false)}
        />
      ) : null}

      {/*
        `perspective` lives on the book, not the leaf: a per-element perspective recomputes its
        vanishing point for each page and the turn stops looking like one object.
      */}
      <div
        className="relative mx-auto w-full max-w-md touch-pan-y select-none"
        style={{
          perspective: "2000px",
          aspectRatio: `${NOTEBOOK_PAGE_CANVAS.width} / ${NOTEBOOK_PAGE_CANVAS.height}`,
        }}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={key}
            custom={direction}
            drag="x"
            dragElastic={0.08}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_event, info) => {
              if (info.offset.x < -TURN_THRESHOLD_PX) turn(1);
              else if (info.offset.x > TURN_THRESHOLD_PX) turn(-1);
            }}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { rotateY: direction > 0 ? -75 : 0, opacity: 0.4 }
            }
            animate={{ rotateY: 0, opacity: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { rotateY: direction > 0 ? 0 : -75, opacity: 0 }
            }
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 260, damping: 30 }
            }
            style={{
              position: "absolute",
              inset: 0,
              transformOrigin: "left center",
              transformStyle: "preserve-3d",
              cursor: "grab",
            }}
          >
            {view.kind === "cover" ? (
              <NotebookCover
                title={t("cover_title")}
                subtitle={t("cover_subtitle", {
                  entries: overview?.entryCount ?? 0,
                  healed: overview?.healedCount ?? 0,
                })}
              >
                <Button onClick={() => turn(1)}>{t("cover_open")}</Button>
              </NotebookCover>
            ) : (
              <NotebookPageSurface paper={pageState.doc.paper}>
                <NotebookPageStage
                  items={pageState.doc.items}
                  entries={page?.entries ?? []}
                  dueIds={dueIds}
                  onOpenEntry={(entry) => {
                    setDue([entry]);
                    setReviewing(true);
                  }}
                  selectedId={editing ? pageState.selectedId : null}
                  onSelect={
                    editing ? (id) => pageDispatch({ type: "select", id }) : undefined
                  }
                  onItemPointerDown={
                    editing
                      ? (event, item) => gesture.begin(event, item, { kind: "move" })
                      : undefined
                  }
                  onPointerMove={editing ? gesture.move : undefined}
                  onPointerUp={editing ? gesture.end : undefined}
                  renderOverlay={
                    editing
                      ? (item) => (
                          <SelectionOverlay
                            resizeHandlers={(corner) =>
                              gesture.handlersFor(item, { kind: "resize", corner })
                            }
                            rotateHandlers={gesture.handlersFor(item, { kind: "rotate" })}
                            resizeLabel={t("edit_resize")}
                            rotateLabel={t("edit_rotate")}
                          />
                        )
                      : undefined
                  }
                />
              </NotebookPageSurface>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" onClick={() => turn(-1)}>
          {t("previous_page")}
        </Button>
        <span className="text-sm tabular-nums" style={{ color: "var(--color-secondary)" }}>
          {view.kind === "cover" ? t("cover_label") : t("page_label", { index: view.index + 1 })}
        </span>
        <Button variant="secondary" onClick={() => turn(1)}>
          {t("next_page")}
        </Button>
      </div>

      {view.kind === "page" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {exam && !adding ? (
              <Button onClick={() => setAdding(true)}>{t("add_open")}</Button>
            ) : null}
            <Button
              variant={editing ? "primary" : "secondary"}
              onClick={() => {
                setEditing((current) => !current);
                pageDispatch({ type: "select", id: null });
              }}
            >
              {editing ? t("edit_done") : t("edit_open")}
            </Button>
          </div>

          {editing ? (
            <NotebookEditBar
              paper={pageState.doc.paper}
              canUndo={canUndo}
              hasSelection={selected != null}
              onAddSticker={(asset: VisionSticker) =>
                pageDispatch({
                  type: "add",
                  item: createStickerItem(asset, pageState.doc.items),
                })
              }
              onAddNote={(text: string) =>
                pageDispatch({
                  type: "add",
                  item: createNoteItem(text, pageState.doc.items),
                })
              }
              onSetPaper={(paper: NotebookPaper) =>
                pageDispatch({ type: "setPaper", paper })
              }
              onUndo={() => pageDispatch({ type: "undo" })}
              onDeleteSelected={() =>
                selected && pageDispatch({ type: "remove", id: selected.id })
              }
            />
          ) : null}

          {adding && exam ? (
            <NotebookAddPanel
              examId={exam.id}
              subjects={exam.subjects}
              onCreated={handleCreated}
              onCancel={() => setAdding(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
