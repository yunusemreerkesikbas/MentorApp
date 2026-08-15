"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  PanelTop,
  Plus,
  Smile,
  StickyNote,
  Trash2,
  Undo2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type {
  ExamCalendarDto,
  ExamSubjectDto,
  ExamTopicDto,
  NotebookEntryDto,
  NotebookOverviewDto,
  NotebookPageDoc,
  NotebookPageDto,
} from "@mentor/types";
import { NOTEBOOK_PAGE_CANVAS, type NotebookPageItem } from "@mentor/types";
import {
  contentControllerCalendarByFamily,
  contentControllerSubjectsBySlug,
  usersControllerMe,
} from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
import { Chip } from "@mentor/ui";
import { FormError } from "@/components/form";
import {
  NotebookCover,
  NotebookPageSurface,
} from "@/components/notebook/notebook-surface";
import { NotebookPageStage } from "@/components/notebook/notebook-page-stage";
import { NotebookTextInlineEditor } from "@/components/notebook/notebook-text-inline-editor";
import { NotebookImageLightbox } from "@/components/notebook/notebook-image-lightbox";
import { fetchExamTopics } from "@/lib/content-topics";
import {
  fetchDueEntries,
  fetchNotebookOverview,
  fetchNotebookPage,
  saveNotebookPage,
} from "@/lib/notebook";
import { createNoteItem, createStickerItem, nextEntrySlot } from "@/lib/notebook-layout";
import { useItemGesture } from "@/components/stage/use-item-gesture";
import { SelectionOverlay } from "@/components/stage/selection-overlay";
import {
  NotebookSidePanel,
  type NotebookPanelCategory,
} from "./notebook-side-panel";
import { useNotebookPage } from "./use-notebook-page";
import { NotebookContentSkeleton } from "./notebook-content-skeleton";
import { NotebookReviewPanel } from "./notebook-review-panel";

/** How far a drag has to travel before it counts as turning the page rather than a stray swipe. */
const TURN_THRESHOLD_PX = 60;

/**
 * A spread shows two facing pages, `left` and `left + 1` — a real notebook has no odd page on its
 * own. Turning moves by two, and turning back past page 0 closes the book: a spread you cannot
 * turn out of would read as broken, and "no visible response" is the worst answer to a swipe.
 */
type View = { kind: "cover" } | { kind: "spread"; left: number };
type Side = "left" | "right";

/** Matches the server's blank page, so an unsaved page and a fetched empty one render alike. */
const EMPTY_PAGE: NotebookPageDoc = { version: 1, paper: "ruled", items: [] };

/** Long enough that a drag settles first, short enough that a closed tab loses nothing. */
const AUTOSAVE_DELAY_MS = 900;

/** Design-space width of the gutter between two facing pages, in the same units as the page canvas. */
const SPINE_GUTTER = 56;

/*
 * `maxWidth` for each surface, capped by BOTH a pixel ceiling and a viewport-height budget, so the
 * notebook shrinks the same way an `object-fit: contain` image would — never forcing the page
 * itself to scroll just because the window is short. `dvh` rather than `vh`: the small chrome
 * mobile browsers show/hide on scroll must not make this recompute mid-scroll.
 *
 * The height budgets (74%/80% of the viewport) are a deliberate approximation, not a measurement
 * of the toolbar/nav/padding around the notebook — getting that exact would need JS layout
 * measurement for a few px of polish. Generous enough that a normal window never overflows; revisit
 * with real numbers if a very short viewport still clips.
 */
const SPREAD_WIDTH_PER_HEIGHT =
  (NOTEBOOK_PAGE_CANVAS.width * 2 + SPINE_GUTTER) / NOTEBOOK_PAGE_CANVAS.height;
const COVER_WIDTH_PER_HEIGHT = NOTEBOOK_PAGE_CANVAS.width / NOTEBOOK_PAGE_CANVAS.height;
const NOTEBOOK_MAX_WIDTH = `min(1180px, calc(74dvh * ${SPREAD_WIDTH_PER_HEIGHT}))`;
const COVER_MAX_WIDTH = `min(560px, calc(80dvh * ${COVER_WIDTH_PER_HEIGHT}))`;

/** Rail buttons that open a category panel. "Not" is a quick action, not a category — it is inlined
 *  in the rail's JSX below rather than listed here, so it has no panel body to switch to. */
const RAIL_CATEGORIES: {
  id: NotebookPanelCategory;
  icon: typeof Plus;
  labelKey: "sidebar_add" | "sidebar_sticker" | "edit_paper";
}[] = [
  { id: "add", icon: Plus, labelKey: "sidebar_add" },
  { id: "sticker", icon: Smile, labelKey: "sidebar_sticker" },
  { id: "paper", icon: PanelTop, labelKey: "edit_paper" },
];

interface ExamContext {
  id: string;
  subjects: ExamSubjectDto[];
  /** Every topic of the exam, carrying its parent subject — the picker filters client-side. */
  topics: ExamTopicDto[];
}

/**
 * The notebook shell: a cover that opens into a two-page spread you turn.
 *
 * The cover is not decoration — it is what makes this "my notebook" rather than a list screen, and
 * the strip on it is what brings the user back. Both halves are load-bearing: the wall gives them
 * something to own, the strip gives them a reason to return.
 *
 * Left and right are two independent pages, each with its own document, gesture session and
 * autosave — not one page rendered twice. `useNotebookPage`/`useItemGesture` are called once per
 * side rather than made to juggle two documents internally, which keeps each hook exactly as small
 * as it was for the single-page shell.
 */
export function NotebookShell() {
  const t = useTranslations("notebook");
  const reduceMotion = useReducedMotion();

  const [view, setView] = useState<View>({ kind: "cover" });
  const [overview, setOverview] = useState<NotebookOverviewDto | null>(null);
  const [exam, setExam] = useState<ExamContext | null>(null);
  const [leftMeta, setLeftMeta] = useState<NotebookPageDto | null>(null);
  const [rightMeta, setRightMeta] = useState<NotebookPageDto | null>(null);
  /** Which side the rail's tools (sticker, note, paper, undo, delete) act on. */
  const [focusedSide, setFocusedSide] = useState<Side>("left");
  /** The rail always has a "current" category; whether its panel is showing is separate. */
  const [activePanel, setActivePanel] = useState<NotebookPanelCategory>("add");
  const [detailCollapsed, setDetailCollapsed] = useState(true);
  /** The one text item currently being typed into, in place, on whichever side it lives. */
  const [editingText, setEditingText] = useState<{ id: string; side: Side } | null>(null);
  const [previewEntry, setPreviewEntry] = useState<NotebookEntryDto | null>(null);

  const leftPage = useNotebookPage(EMPTY_PAGE);
  const rightPage = useNotebookPage(EMPTY_PAGE);
  const leftGesture = useItemGesture<NotebookPageItem>({
    patch: leftPage.patch,
    checkpoint: leftPage.checkpoint,
    lockRatioFor: (item) => item.kind === "sticker",
    canvasWidth: NOTEBOOK_PAGE_CANVAS.width,
  });
  const rightGesture = useItemGesture<NotebookPageItem>({
    patch: rightPage.patch,
    checkpoint: rightPage.checkpoint,
    lockRatioFor: (item) => item.kind === "sticker",
    canvasWidth: NOTEBOOK_PAGE_CANVAS.width,
  });
  const focused = focusedSide === "left" ? leftPage : rightPage;

  const [due, setDue] = useState<NotebookEntryDto[]>([]);
  const [reviewing, setReviewing] = useState(false);
  /** A single card opened by double-click — a separate flow from the due-strip's list. */
  const [singleReview, setSingleReview] = useState<NotebookEntryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** +1 turning forward, -1 turning back — decides which way the spread slides. */
  const [direction, setDirection] = useState<1 | -1>(1);

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
          // Both taxonomies in one round-trip pair: the topic list is small enough to hold whole,
          // which spares the picker a fetch every time the subject changes.
          const [subjects, topics] = await Promise.all([
            contentControllerSubjectsBySlug(current.slug) as unknown as Promise<
              ExamSubjectDto[]
            >,
            fetchExamTopics(current.slug),
          ]);
          return { id: current.id, subjects, topics };
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

  // Fetch both facing pages together: neither needs the other's answer, and chaining them would
  // make the right page visibly pop in a beat after the left one.
  useEffect(() => {
    if (view.kind !== "spread") return;
    let cancelled = false;
    const { left } = view;

    Promise.all([fetchNotebookPage(left), fetchNotebookPage(left + 1)])
      .then(([leftData, rightData]) => {
        if (cancelled) return;
        setLeftMeta(leftData);
        setRightMeta(rightData);
        leftPage.dispatch({ type: "replace", doc: leftData.doc });
        rightPage.dispatch({ type: "replace", doc: rightData.doc });
      })
      .catch(() => {
        if (!cancelled) setError(t("error_load"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch identities are stable
  }, [view, t]);

  /*
   * Autosave rather than a save button: the user came here to review, and a page that silently
   * loses a dragged sticker because they navigated away is worse than any save affordance. One
   * effect per side — each page saves on its own schedule, so arranging the left page never resets
   * the right page's pending timer.
   *
   * A failed save is never a red banner — `dispatch({type:"saved"})` simply does not run, so
   * `state.dirty` stays true exactly as it would while a save is still pending. The toolbar's
   * "Kaydedilmedi" indicator (mirroring the vision board's own) already reads off that same flag,
   * which means "still trying" and "just failed" look identical to the user on purpose: nothing
   * is lost either way — the draft is the React state itself, not the last successful PUT — and
   * the very next edit (or a tap on "Kaydet") retries automatically.
   */
  useEffect(() => {
    if (view.kind !== "spread" || !leftPage.state.dirty) return;
    const index = view.left;
    const doc = leftPage.state.doc;
    const timer = setTimeout(() => {
      saveNotebookPage(index, doc)
        .then(() => leftPage.dispatch({ type: "saved" }))
        .catch(() => undefined);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch identity is stable
  }, [leftPage.state.dirty, leftPage.state.doc, view]);

  useEffect(() => {
    if (view.kind !== "spread" || !rightPage.state.dirty) return;
    const index = view.left + 1;
    const doc = rightPage.state.doc;
    const timer = setTimeout(() => {
      saveNotebookPage(index, doc)
        .then(() => rightPage.dispatch({ type: "saved" }))
        .catch(() => undefined);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch identity is stable
  }, [rightPage.state.dirty, rightPage.state.doc, view]);

  /**
   * The vision board's "Kaydet" button, for the same reason it has one: an autosave that just
   * failed silently is exactly the moment a visible, immediate retry matters most. Saves whichever
   * side(s) are actually dirty — usually one, occasionally both if the user arranged both pages in
   * the same debounce window.
   */
  const [saving, setSaving] = useState(false);
  const saveNow = useCallback(async () => {
    if (view.kind !== "spread") return;
    setSaving(true);
    try {
      await Promise.all([
        leftPage.state.dirty
          ? saveNotebookPage(view.left, leftPage.state.doc).then(() =>
              leftPage.dispatch({ type: "saved" }),
            )
          : null,
        rightPage.state.dirty
          ? saveNotebookPage(view.left + 1, rightPage.state.doc).then(() =>
              rightPage.dispatch({ type: "saved" }),
            )
          : null,
      ]);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch identities are stable
  }, [view, leftPage.state.dirty, leftPage.state.doc, rightPage.state.dirty, rightPage.state.doc]);

  const turn = useCallback((delta: 1 | -1) => {
    setDirection(delta);
    setFocusedSide("left");
    setEditingText(null);
    setView((current) => {
      if (current.kind === "cover") {
        return delta > 0 ? { kind: "spread", left: 0 } : current;
      }
      const nextLeft = current.left + delta * 2;
      if (nextLeft < 0) return { kind: "cover" };
      return { kind: "spread", left: nextLeft };
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

  /** Click a rail icon: switch to it and open the panel, or collapse it if it was already active. */
  const openCategory = useCallback((id: NotebookPanelCategory) => {
    setActivePanel((current) => {
      if (current === id) {
        setDetailCollapsed((collapsed) => !collapsed);
        return current;
      }
      setDetailCollapsed(false);
      return id;
    });
  }, []);

  /**
   * "Not": place a blank note on the focused page and start typing into it immediately, in place —
   * the vision board's `addText` action, minus the extra step of then double-clicking to edit.
   * Seeded with empty text on purpose: the schema requires non-empty text, so a note nobody typed
   * into is deleted on blur (`handleTextEditDone`) rather than ever being saved blank.
   */
  const handleAddNote = useCallback(() => {
    const item = createNoteItem("", focused.state.doc.items);
    focused.dispatch({ type: "add", item });
    setEditingText({ id: item.id, side: focusedSide });
  }, [focused, focusedSide]);

  const handleTextEditDone = useCallback(() => {
    setEditingText((current) => {
      if (!current) return current;
      const hook = current.side === "left" ? leftPage : rightPage;
      const item = hook.state.doc.items.find((candidate) => candidate.id === current.id);
      if (item && item.kind === "text" && !item.text.trim()) {
        hook.dispatch({ type: "remove", id: current.id });
      }
      return null;
    });
  }, [leftPage, rightPage]);

  const handleItemDoubleClick = useCallback(
    (side: Side, item: NotebookPageItem) => {
      if (item.kind === "entry") {
        const meta = side === "left" ? leftMeta : rightMeta;
        const found = meta?.entries.find((entry) => entry.id === item.entryId);
        if (found) setSingleReview(found);
        return;
      }
      if (item.kind === "text") {
        (side === "left" ? leftPage : rightPage).checkpoint();
        setEditingText({ id: item.id, side });
      }
    },
    [leftMeta, rightMeta, leftPage, rightPage],
  );

  /**
   * Place a freshly saved entry on the focused page.
   *
   * The entry row already exists at this point — placing it only records where its card sits, and
   * the autosave effect persists that. If the focused page is full we say so rather than stacking a
   * card off the bottom edge where nobody would find it.
   */
  const handleCreated = useCallback(
    (entry: NotebookEntryDto) => {
      const slot = nextEntrySlot(focused.state.doc.items);
      if (!slot) {
        setError(t("error_page_full"));
        return;
      }
      focused.dispatch({
        type: "add",
        item: { ...slot, id: crypto.randomUUID(), kind: "entry", entryId: entry.id, opacity: 1 },
      });
      const setMeta = focusedSide === "left" ? setLeftMeta : setRightMeta;
      setMeta((current) =>
        current ? { ...current, entries: [...current.entries, entry] } : current,
      );
      setDetailCollapsed(true);
    },
    [focused, focusedSide, t],
  );

  /**
   * A reviewed entry is patched in place rather than refetched: whichever side's page holds the
   * card already knows it, and the server's answer is the whole new state of it. This is what
   * makes a healed card fade on the wall the moment it heals, on whichever side it sits.
   */
  const handleReviewed = useCallback((updated: NotebookEntryDto) => {
    setDue((current) => current.filter((entry) => entry.id !== updated.id));
    const patchMeta = (meta: NotebookPageDto | null) =>
      meta && meta.entries.some((entry) => entry.id === updated.id)
        ? {
            ...meta,
            entries: meta.entries.map((entry) =>
              entry.id === updated.id ? updated : entry,
            ),
          }
        : meta;
    setLeftMeta(patchMeta);
    setRightMeta(patchMeta);
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
  const isSpread = view.kind === "spread";
  /**
   * Both leaves move together; the incoming spread carries a higher z-index than the outgoing one
   * so a forward turn visibly sweeps the new pages in over the old left page, not just beside it.
   */
  const spreadVariants = {
    enter: (dir: 1 | -1) =>
      reduceMotion ? { opacity: 0, zIndex: 2 } : { x: `${dir * 100}%`, zIndex: 2 },
    center: { x: "0%", opacity: 1, zIndex: 2 },
    exit: (dir: 1 | -1) =>
      reduceMotion
        ? { opacity: 0, zIndex: 1 }
        : { x: `${dir * -30}%`, opacity: 0.4, zIndex: 1 },
  };
  const pageLabel = isSpread
    ? t("page_range_label", { from: view.left + 1, to: view.left + 2 })
    : t("cover_label");

  return (
    <div className="flex flex-col gap-3 px-1 pb-4 pt-2 sm:px-2 sm:pb-6 sm:pt-3 lg:pb-8 lg:pt-3">
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
      ) : singleReview ? (
        <NotebookReviewPanel
          entries={[singleReview]}
          onReviewed={(updated) => {
            handleReviewed(updated);
            setSingleReview(null);
          }}
          onClose={() => setSingleReview(null)}
        />
      ) : null}

      <NotebookImageLightbox entry={previewEntry} onClose={() => setPreviewEntry(null)} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {/*
          Icon rail + expandable panel, mirroring the vision board's editor chrome: the rail
          decides WHAT you're placing, the panel holds the controls for it. It only exists once a
          spread is open — the cover has nothing to arrange yet.
        */}
        {isSpread ? (
          <>
            <nav
              aria-label={t("sidebar_nav")}
              className="mentor-scrollarea flex shrink-0 gap-1 overflow-x-auto rounded-[var(--radius-card)] border px-2 py-2 lg:w-16 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:px-1 lg:py-3"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "color-mix(in srgb, var(--color-main) 10%, transparent)",
              }}
            >
              {RAIL_CATEGORIES.map(({ id, icon: Icon, labelKey }) => {
                const active = activePanel === id && !detailCollapsed;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => openCategory(id)}
                    className="relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-card)] px-1 py-1.5 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] lg:w-full lg:min-w-0"
                    style={{
                      color: active ? "#ffffff" : "var(--color-secondary)",
                      backgroundColor: active ? "var(--color-main)" : "transparent",
                    }}
                  >
                    <Icon aria-hidden size={20} />
                    <span className="leading-tight">{t(labelKey)}</span>
                  </button>
                );
              })}
              {/* Not a category: clicking places a note on the page and starts typing right away. */}
              <button
                type="button"
                onClick={handleAddNote}
                className="relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-card)] px-1 py-1.5 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] lg:w-full lg:min-w-0"
                style={{ color: "var(--color-secondary)" }}
              >
                <StickyNote aria-hidden size={20} />
                <span className="leading-tight">{t("sidebar_note")}</span>
              </button>
            </nav>

            <AnimatePresence initial={false}>
              {!detailCollapsed ? (
                <motion.aside
                  key="notebook-detail-panel"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="relative flex min-h-0 max-h-[50vh] w-full shrink-0 flex-col rounded-[var(--radius-card)] border lg:max-h-none lg:w-80"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderColor: "color-mix(in srgb, var(--color-main) 10%, transparent)",
                  }}
                >
                  <button
                    type="button"
                    aria-label={t("sidebar_collapse")}
                    onClick={() => setDetailCollapsed(true)}
                    className="absolute end-0 top-1/2 z-10 hidden h-11 w-5 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full lg:inline-flex"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      boxShadow: "var(--shadow-card)",
                      color: "var(--color-main)",
                    }}
                  >
                    <ChevronLeft aria-hidden size={14} />
                  </button>
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <NotebookSidePanel
                      category={activePanel}
                      paper={focused.state.doc.paper}
                      exam={exam}
                      onCreated={handleCreated}
                      onAddSticker={(asset) =>
                        focused.dispatch({
                          type: "add",
                          item: createStickerItem(asset, focused.state.doc.items),
                        })
                      }
                      onSetPaper={(paper) => focused.dispatch({ type: "setPaper", paper })}
                      onCollapse={() => setDetailCollapsed(true)}
                    />
                  </div>
                </motion.aside>
              ) : null}
            </AnimatePresence>
          </>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          {isSpread ? (
            <div
              className="flex w-full items-center gap-1"
              style={{ maxWidth: NOTEBOOK_MAX_WIDTH }}
            >
              <button
                type="button"
                aria-label={t("edit_undo")}
                disabled={!focused.canUndo}
                onClick={() => focused.dispatch({ type: "undo" })}
                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-[var(--color-surface-container)] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                style={{ color: "var(--color-main)" }}
              >
                <Undo2 aria-hidden size={17} />
              </button>
              <button
                type="button"
                aria-label={t("edit_delete")}
                disabled={focused.selected == null}
                onClick={() =>
                  focused.selected &&
                  focused.dispatch({ type: "remove", id: focused.selected.id })
                }
                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-[var(--color-surface-container)] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                style={{ color: "var(--color-main)" }}
              >
                <Trash2 aria-hidden size={17} />
              </button>

              {/* Mirrors the vision board's own toolbar: an "unsaved" text, not an error banner —
                  a failed autosave and a pending one look identical here on purpose (see the
                  autosave effects above), and "Kaydet" is the visible, immediate retry. */}
              <div className="ms-auto flex items-center gap-2">
                {leftPage.state.dirty || rightPage.state.dirty ? (
                  <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
                    {t("unsaved")}
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={saving || (!leftPage.state.dirty && !rightPage.state.dirty)}
                  aria-busy={saving || undefined}
                  onClick={() => void saveNow()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white outline-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  style={{ backgroundColor: "var(--color-btn)" }}
                >
                  {saving ? (
                    <LoaderCircle
                      aria-hidden
                      size={13}
                      className="animate-spin motion-reduce:animate-none"
                    />
                  ) : null}
                  {t("save")}
                </button>
              </div>
            </div>
          ) : null}

          {/*
            The wrapper's own aspect ratio switches between a single cover and a two-page spread,
            so the absolutely-positioned motion layers beneath it always have a real size to fill.
            `maxWidth` also folds in a viewport-height budget (via `min()`) so the notebook can
            never force the page itself to scroll — it shrinks by width *and* height together,
            the same as an `object-fit: contain` image would, rather than only ever by width.
          */}
          <div
            className="relative w-full touch-pan-y select-none"
            style={{
              maxWidth: isSpread ? NOTEBOOK_MAX_WIDTH : COVER_MAX_WIDTH,
              aspectRatio: isSpread
                ? `${NOTEBOOK_PAGE_CANVAS.width * 2 + SPINE_GUTTER} / ${NOTEBOOK_PAGE_CANVAS.height}`
                : `${NOTEBOOK_PAGE_CANVAS.width} / ${NOTEBOOK_PAGE_CANVAS.height}`,
            }}
          >
            {/*
              Two nested regions on purpose. The outer one only ever swaps cover↔spread — a
              structural change, so it waits for the exit to finish before the aspect ratio jumps
              from one page wide to two. The inner one turns pages *within* an open book: both
              leaves move, and the incoming spread is given a higher z-index so it visibly sweeps
              in over the outgoing one rather than just crossfading beside it.
            */}
            <AnimatePresence initial={false} mode="wait">
              {view.kind === "cover" ? (
                <motion.div
                  key="cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.25 }}
                  style={{ position: "absolute", inset: 0 }}
                >
                  <NotebookCover
                    title={t("cover_title")}
                    subtitle={t("cover_subtitle", {
                      entries: overview?.entryCount ?? 0,
                      healed: overview?.healedCount ?? 0,
                    })}
                    onOpen={() => turn(1)}
                    openLabel={t("cover_open")}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="spread-container"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.2 }}
                  style={{ position: "absolute", inset: 0, overflow: "hidden" }}
                >
                  <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                      key={`spread-${view.left}`}
                      custom={direction}
                      variants={spreadVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      drag="x"
                      dragElastic={0.08}
                      dragConstraints={{ left: 0, right: 0 }}
                      onDragEnd={(_event, info) => {
                        if (info.offset.x < -TURN_THRESHOLD_PX) turn(1);
                        else if (info.offset.x > TURN_THRESHOLD_PX) turn(-1);
                      }}
                      transition={
                        reduceMotion
                          ? { duration: 0.15 }
                          : { type: "tween", duration: 0.38, ease: "easeInOut" }
                      }
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        gap: "1.5%",
                        cursor: "grab",
                      }}
                    >
                      <div className="h-full min-w-0 flex-1">
                        <NotebookPageSurface paper={leftPage.state.doc.paper}>
                          <NotebookPageStage
                            items={leftPage.state.doc.items}
                            entries={leftMeta?.entries ?? []}
                            dueIds={dueIds}
                            selectedId={leftPage.state.selectedId}
                            contentHiddenId={
                              editingText?.side === "left" ? editingText.id : null
                            }
                            onSelect={(id) => {
                              setFocusedSide("left");
                              leftPage.dispatch({ type: "select", id });
                            }}
                            onItemPointerDown={(event, item) =>
                              leftGesture.begin(event, item, { kind: "move" })
                            }
                            onItemDoubleClick={(item) => handleItemDoubleClick("left", item)}
                            onPreviewImage={setPreviewEntry}
                            onPointerMove={leftGesture.move}
                            onPointerUp={leftGesture.end}
                            renderOverlay={(item) =>
                              item.kind === "text" &&
                              editingText?.side === "left" &&
                              editingText.id === item.id ? (
                                <NotebookTextInlineEditor
                                  item={item}
                                  label={t("edit_note_label")}
                                  onChange={(text) => leftPage.patch(item.id, { text })}
                                  onDone={handleTextEditDone}
                                />
                              ) : (
                                <SelectionOverlay
                                  resizeHandlers={(corner) =>
                                    leftGesture.handlersFor(item, { kind: "resize", corner })
                                  }
                                  rotateHandlers={leftGesture.handlersFor(item, {
                                    kind: "rotate",
                                  })}
                                  resizeLabel={t("edit_resize")}
                                  rotateLabel={t("edit_rotate")}
                                />
                              )
                            }
                          />
                        </NotebookPageSurface>
                      </div>

                      {/* The spine — just enough of a seam to read as one open book, not two cards. */}
                      <div
                        aria-hidden
                        className="h-full w-3 shrink-0"
                        style={{
                          background:
                            "linear-gradient(90deg, transparent, rgba(0,0,0,0.10), transparent)",
                        }}
                      />

                      <div className="h-full min-w-0 flex-1">
                        <NotebookPageSurface paper={rightPage.state.doc.paper}>
                          <NotebookPageStage
                            items={rightPage.state.doc.items}
                            entries={rightMeta?.entries ?? []}
                            dueIds={dueIds}
                            selectedId={rightPage.state.selectedId}
                            contentHiddenId={
                              editingText?.side === "right" ? editingText.id : null
                            }
                            onSelect={(id) => {
                              setFocusedSide("right");
                              rightPage.dispatch({ type: "select", id });
                            }}
                            onItemPointerDown={(event, item) =>
                              rightGesture.begin(event, item, { kind: "move" })
                            }
                            onItemDoubleClick={(item) => handleItemDoubleClick("right", item)}
                            onPreviewImage={setPreviewEntry}
                            onPointerMove={rightGesture.move}
                            onPointerUp={rightGesture.end}
                            renderOverlay={(item) =>
                              item.kind === "text" &&
                              editingText?.side === "right" &&
                              editingText.id === item.id ? (
                                <NotebookTextInlineEditor
                                  item={item}
                                  label={t("edit_note_label")}
                                  onChange={(text) => rightPage.patch(item.id, { text })}
                                  onDone={handleTextEditDone}
                                />
                              ) : (
                                <SelectionOverlay
                                  resizeHandlers={(corner) =>
                                    rightGesture.handlersFor(item, { kind: "resize", corner })
                                  }
                                  rotateHandlers={rightGesture.handlersFor(item, {
                                    kind: "rotate",
                                  })}
                                  resizeLabel={t("edit_resize")}
                                  rotateLabel={t("edit_rotate")}
                                />
                              )
                            }
                          />
                        </NotebookPageSurface>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/*
            Pagination-style controls, pinned to the bottom of the column: an icon each side of the
            label, not a text button each side — the label alone already says where you are.
          */}
          <div className="mt-auto flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              aria-label={t("previous_page")}
              onClick={() => turn(-1)}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
                color: "var(--color-main)",
                backgroundColor: "var(--color-surface)",
              }}
            >
              <ChevronLeft aria-hidden size={18} />
            </button>
            <span className="text-sm tabular-nums" style={{ color: "var(--color-secondary)" }}>
              {pageLabel}
            </span>
            <button
              type="button"
              aria-label={t("next_page")}
              onClick={() => turn(1)}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
                color: "var(--color-main)",
                backgroundColor: "var(--color-surface)",
              }}
            >
              <ChevronRight aria-hidden size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
