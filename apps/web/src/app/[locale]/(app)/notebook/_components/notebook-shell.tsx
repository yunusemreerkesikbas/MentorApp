"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  History,
  LoaderCircle,
  StickyNote,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import { useTranslations } from "next-intl";
import type {
  ExamCalendarDto,
  ExamSubjectDto,
  ExamTopicDto,
  NotebookEntryDto,
  NotebookOverviewDto,
  NotebookPageDto,
  NotebookPaper,
  VisionBoardTextItem,
} from "@mentor/types";
import { NOTEBOOK_PAGE_CANVAS, type NotebookPageItem } from "@mentor/types";
import {
  contentControllerCalendarByFamily,
  contentControllerSubjectsBySlug,
  usersControllerMe,
} from "@mentor/api-client";
import type {
  AuthUser,
  NotebookCoverDoc,
  NotebookPageDoc,
} from "@mentor/types";

/**
 * How the mobile page slides.
 *
 * Faster than the desktop leaf, and not the same kind of motion at all: a leaf turning is an object
 * with weight and a full second is what sells it, while a page sliding is navigation and anything
 * over a third of a second reads as the phone being slow.
 */
const MOBILE_SLIDE = { duration: 0.32, ease: [0.22, 1, 0.36, 1] } as const;
import { FormError } from "@/components/form";
import {
  NotebookCover,
  NotebookPageSurface,
  NotebookSpine,
  PAGE_PERCENT,
  SPINE_GUTTER,
} from "@/components/notebook/notebook-surface";
import { NotebookPageStage } from "@/components/notebook/notebook-page-stage";
import { NotebookInkLayer } from "@/components/notebook/notebook-ink-layer";
import { useInkDraw } from "@/components/notebook/use-ink-draw";
import {} from "@/lib/notebook-ink";
import { NotebookInkToolbar } from "./notebook-ink-toolbar";
import { useNotebookInkSettings } from "./use-notebook-ink-settings";
import {
  NotebookMobileToolRail,
  NotebookRailActiveFill,
  RAIL_CATEGORIES,
} from "./notebook-rail-items";
import {
  AUTOSAVE_DELAY_MS,
  COVER_MAX_WIDTH_PX,
  EMPTY_PAGE,
  fitWithin,
  MOBILE_LEAF_MAX_WIDTH_PX,
  MOBILE_QUERY,
  NOTEBOOK_MAX_WIDTH_PX,
  NOTEBOOK_TRAY_RADIUS_CLASS,
  NOTEBOOK_Z,
  useFitSize,
  type Side,
  type View,
} from "./notebook-shell-layout";
import { MOBILE_BELOW_APP_CHROME_HEIGHT_CLASS } from "@/lib/app-shell";
import {
  boardChromeFastTransition,
  boardChromeTransition,
} from "../../vision-board/board/_components/board-chrome-motion";
import {
  NotebookPageTurn,
  PAGE_TURN_SECONDS,
} from "@/components/notebook/notebook-page-turn";
import { NotebookTextInlineEditor } from "@/components/notebook/notebook-text-inline-editor";
import { NotebookImageLightbox } from "@/components/notebook/notebook-image-lightbox";
import { fetchExamTopics } from "@/lib/content-topics";
import { measureImageAspect } from "@/lib/notebook-image-aspect";
import { clearSpentQueryParam } from "@/lib/spent-query-param";
import {
  deleteNotebookEntry,
  fetchDueEntries,
  fetchNotebook,
  fetchNotebookOverview,
  fetchNotebookPage,
  saveNotebookPage,
  updateNotebook,
} from "@/lib/notebook";
import {
  createNoteItem,
  createStickerItem,
  nextEntrySlot,
} from "@/lib/notebook-layout";
import { useItemGesture } from "@/components/stage/use-item-gesture";
import { SelectionOverlay } from "@/components/stage/selection-overlay";
import {
  NotebookSidePanel,
  type NotebookPanelCategory,
} from "./notebook-side-panel";
import { useNotebookPage } from "./use-notebook-page";
import { NotebookContentSkeleton } from "./notebook-content-skeleton";
import { NotebookReviewPanel } from "./notebook-review-panel";
import { useMentorToast } from "@/lib/mentor-toast";
import { reviewFeedback } from "@/lib/notebook-review-deck";
import { NotebookEntryEditDialog } from "./notebook-entry-edit-dialog";
import { NotebookRemoveChoiceDialog } from "./notebook-remove-choice-dialog";

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
export function NotebookShell({ notebookId }: { notebookId?: string }) {
  const t = useTranslations("notebook");
  const toast = useMentorToast();
  const reduceMotion = useReducedMotion();

  const [view, setView] = useState<View>({ kind: "cover" });
  const [overview, setOverview] = useState<NotebookOverviewDto | null>(null);
  const [exam, setExam] = useState<ExamContext | null>(null);
  const [leftMeta, setLeftMeta] = useState<NotebookPageDto | null>(null);
  const [rightMeta, setRightMeta] = useState<NotebookPageDto | null>(null);
  /** Which side the rail's tools (sticker, note, paper, undo, delete) act on. */
  const [focusedSide, setFocusedSide] = useState<Side>("left");
  /**
   * The mock exam whose mistakes are being filed, carried in from the analysis screen. Stamped onto
   * every entry created in this visit so a card can later say which exam it came out of — the
   * column has existed since the table was created with nothing ever filling it.
   */
  const [mockExamId, setMockExamId] = useState<string | null>(null);
  /** Book-level metadata, composed for the existing cover controls. */
  const [cover, setCover] = useState<NotebookCoverDoc | null>(null);
  /** The rail always has a "current" category; whether its panel is showing is separate. */
  const [activePanel, setActivePanel] = useState<NotebookPanelCategory>(
    notebookId ? "sticker" : "add",
  );
  const [detailCollapsed, setDetailCollapsed] = useState(true);
  /** The one text item currently being typed into, in place, on whichever side it lives. */
  const [editingText, setEditingText] = useState<{
    id: string;
    side: Side;
  } | null>(null);
  const [previewEntry, setPreviewEntry] = useState<NotebookEntryDto | null>(
    null,
  );

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

  /*
   * One pen setting for the whole notebook, but a draw session per side — the same split as the
   * page documents themselves. Picking up the red marker should not become picking it up twice
   * when you turn to a spread, while a stroke has to land in the document of the page it was
   * drawn on, and each page autosaves separately.
   */
  const ink = useNotebookInkSettings();

  const leftInk = useInkDraw({
    tool: ink.tool,
    color: ink.color,
    size: ink.size,
    opacity: ink.opacity,
    onStroke: leftPage.addStroke,
    onErase: leftPage.eraseStrokes,
    getStrokes: () => leftPage.state.doc.ink,
  });
  const rightInk = useInkDraw({
    tool: ink.tool,
    color: ink.color,
    size: ink.size,
    opacity: ink.opacity,
    onStroke: rightPage.addStroke,
    onErase: rightPage.eraseStrokes,
    getStrokes: () => rightPage.state.doc.ink,
  });

  /**
   * The page sliding out, on mobile — a still of what was on screen a moment ago.
   *
   * A slide needs two pages: the one leaving and the one arriving. The leaf turn never did, because
   * the leaf it flew was blank and opaque and the swap happened underneath it. Here the outgoing
   * half has to still show the old page, and `mobilePage` has already moved on by the time the
   * animation starts — so the document is kept by reference for the length of the slide. It costs
   * nothing to hold and nothing to fetch: this is the same object that was being rendered a frame
   * ago, not a third page pulled from the server.
   */
  const [outgoing, setOutgoing] = useState<{
    seq: number;
    dir: 1 | -1;
    doc: NotebookPageDoc;
    entries: NotebookEntryDto[];
  } | null>(null);
  const slideSeq = useRef(0);

  /** Below `MOBILE_QUERY`, a spread shows one leaf at a time (`mobileSide`) instead of two. */
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia(MOBILE_QUERY).matches,
  );
  const [mobileSide, setMobileSide] = useState<Side>("left");
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // The toolbar (undo/delete/save) and rail actions (Ekle/Sticker/Not) all act on `focused` — on
  // mobile that must always be the one leaf actually on screen (`mobileSide`), not whichever side
  // was last explicitly selected, so it takes over from `focusedSide` there rather than syncing it.
  const focused =
    (isMobile ? mobileSide : focusedSide) === "left" ? leftPage : rightPage;

  const [fitRef, fitBox] = useFitSize<HTMLDivElement>();

  const [due, setDue] = useState<NotebookEntryDto[]>([]);
  const [reviewing, setReviewing] = useState(false);
  /** A single card opened by double-click — a separate flow from the due-strip's list. */
  /**
   * Bumped whenever an entry is edited or deleted. The index panel lists rows the server owns, and
   * both of those happen outside it — without this a deleted card stays in the list and opens an
   * empty preview.
   */
  const [indexRefreshKey, setIndexRefreshKey] = useState(0);
  /** The card whose labels are being corrected, or which is about to be deleted for good. */
  const [editingEntry, setEditingEntry] = useState<NotebookEntryDto | null>(
    null,
  );
  /**
   * A card selected on the page with the trash pressed: the student has to say which "delete" they
   * meant, because until now the button silently meant the weaker one and the card came back the
   * next day.
   */
  const [removingItem, setRemovingItem] = useState<{
    itemId: string;
    entry: NotebookEntryDto;
  } | null>(null);
  /**
   * Cards the student chose to go over now, rather than the ones the schedule offered.
   *
   * Its own state next to `singleReview` because the two end differently: a single card opened from
   * a page closes the moment it is answered, while a session the student assembled walks its own
   * deck to the end like the due one does.
   */
  const [studyDeck, setStudyDeck] = useState<NotebookEntryDto[] | null>(null);
  const [singleReview, setSingleReview] = useState<NotebookEntryDto | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  /**
   * The leaf currently in flight, if any. `seq` only exists to remount the animation when two turns
   * land back to back — otherwise React would keep the half-finished one on screen. `single` mirrors
   * whatever `isMobile` was the instant the turn started, so a resize mid-flight can't change the
   * shape of a leaf that's already airborne.
   */
  const [flip, setFlip] = useState<{
    seq: number;
    dir: 1 | -1;
    paper: NotebookPaper;
    single: boolean;
  } | null>(null);
  const flipSeq = useRef(0);

  /*
   * Overview, due list and exam taxonomy load together rather than in sequence: none of them needs
   * another's answer, and chaining them would stack three round-trips before the cover appears.
   */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (notebookId) {
        try {
          const notebook = await fetchNotebook(notebookId);
          if (cancelled) return;
          setOverview({
            notebook,
            pageCount: notebook.pageCount,
            entryCount: 0,
            dueCount: 0,
            healedCount: 0,
          });
          setCover({ ...notebook.cover, title: notebook.title });
        } catch {
          if (!cancelled) setError(t("error_load"));
        }
        return;
      }

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

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value);
        setCover({
          ...overviewResult.value.notebook.cover,
          title: overviewResult.value.notebook.title,
        });
      } else setError(t("error_load"));

      if (dueResult.status === "fulfilled") {
        setDue(dueResult.value);
        // The push notification deep-links here; landing on the cover and making the user hunt for
        // the strip would waste the one moment they actually came back for.
        if (
          dueResult.value.length > 0 &&
          new URLSearchParams(window.location.search).get("review") === "due"
        ) {
          setReviewing(true);
          clearSpentQueryParam("review");
        }
      }

      // Handed over from the analysis screen right after a mock exam was saved: they came here to
      // file the mistakes they just counted, so open the form rather than the cover.
      const handedOverMock = new URLSearchParams(window.location.search).get(
        "mockExam",
      );
      if (handedOverMock) {
        setMockExamId(handedOverMock);
        setView({ kind: "spread", left: 0 });
        setActivePanel("add");
        setDetailCollapsed(false);
        // Spent: a refresh would otherwise reopen the form and stamp this exam onto whatever the
        // student files next, quietly attributing later mistakes to an old sitting.
        clearSpentQueryParam("mockExam");
      }
      // A missing exam only disables *adding*, so it is not an error banner — the user can still
      // read the notebook they already have.
      if (examResult.status === "fulfilled") setExam(examResult.value);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [notebookId, t]);

  // Fetch both facing pages together: neither needs the other's answer, and chaining them would
  // make the right page visibly pop in a beat after the left one.
  useEffect(() => {
    if (view.kind !== "spread") return;
    let cancelled = false;
    const { left } = view;

    Promise.all([
      fetchNotebookPage(left, notebookId),
      fetchNotebookPage(left + 1, notebookId),
    ])
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
  }, [view, t, notebookId]);

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
      saveNotebookPage(index, doc, notebookId)
        .then(() => leftPage.dispatch({ type: "saved" }))
        .catch(() => undefined);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch identity is stable
  }, [leftPage.state.dirty, leftPage.state.doc, view, notebookId]);

  useEffect(() => {
    if (view.kind !== "spread" || !rightPage.state.dirty) return;
    const index = view.left + 1;
    const doc = rightPage.state.doc;
    const timer = setTimeout(() => {
      saveNotebookPage(index, doc, notebookId)
        .then(() => rightPage.dispatch({ type: "saved" }))
        .catch(() => undefined);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch identity is stable
  }, [rightPage.state.dirty, rightPage.state.doc, view, notebookId]);

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
          ? saveNotebookPage(view.left, leftPage.state.doc, notebookId).then(
              () => leftPage.dispatch({ type: "saved" }),
            )
          : null,
        rightPage.state.dirty
          ? saveNotebookPage(
              view.left + 1,
              rightPage.state.doc,
              notebookId,
            ).then(() => rightPage.dispatch({ type: "saved" }))
          : null,
      ]);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch identities are stable
  }, [
    view,
    leftPage.state.dirty,
    leftPage.state.doc,
    rightPage.state.dirty,
    rightPage.state.doc,
    notebookId,
  ]);

  /* Read off the hooks up front: `turn` needs only the two papers, and depending on the hook objects
     themselves would rebuild it every render — and with it the keydown listener it feeds. */
  const leftPaper = leftPage.state.doc.paper;
  const rightPaper = rightPage.state.doc.paper;
  /**
   * Freeze what is on screen so it can be slid off it.
   *
   * Nothing here schedules the removal — the slide's own `onAnimationComplete` does, keyed by the
   * same sequence number, so a second page change while the first is still moving replaces the
   * still instead of racing a timer that would clear the wrong one.
   */
  const startSlide = useCallback(
    (dir: 1 | -1) => {
      if (reduceMotion) return;
      slideSeq.current += 1;
      // Resolved from the two page hooks rather than from `mobilePage`, which is derived further
      // down the component than this callback is defined. Same expression, no forward reference.
      const leaving = mobileSide === "left" ? leftPage : rightPage;
      const leavingMeta = mobileSide === "left" ? leftMeta : rightMeta;
      setOutgoing({
        seq: slideSeq.current,
        dir,
        doc: leaving.state.doc,
        entries: leavingMeta?.entries ?? [],
      });
    },
    [leftMeta, leftPage, mobileSide, reduceMotion, rightMeta, rightPage],
  );

  const turn = useCallback(
    (delta: 1 | -1) => {
      setFocusedSide("left");
      setEditingText(null);

      /*
       * A leaf only turns *inside* an open book. Opening or closing the cover moves the whole
       * board, not a page, so those two keep the plain crossfade they already had. The paper of the
       * leaf we are lifting — right side going forward, left side going back — travels with it, so
       * the flying sheet is ruled like the book it came out of.
       */
      if (
        view.kind === "spread" &&
        !reduceMotion &&
        view.left + delta * 2 >= 0
      ) {
        // On mobile the pages slide past each other instead of one turning over: a phone shows
        // one page at a time, and a book that flips a whole leaf to move one page reads as a
        // stutter. Which of the two runs is decided here, once, so nothing downstream has to ask.
        if (isMobile) startSlide(delta);
        else {
          flipSeq.current += 1;
          setFlip({
            seq: flipSeq.current,
            dir: delta,
            paper: delta > 0 ? rightPaper : leftPaper,
            single: false,
          });
        }
      }

      setView((current) => {
        if (current.kind === "cover") {
          return delta > 0 ? { kind: "spread", left: 0 } : current;
        }
        const nextLeft = current.left + delta * 2;
        if (nextLeft < 0) return { kind: "cover" };
        return { kind: "spread", left: nextLeft };
      });
    },
    [view, reduceMotion, leftPaper, rightPaper, isMobile, startSlide],
  );

  /**
   * The button/keyboard entry point for moving through the book. `turn` always moves a whole
   * spread — correct for desktop, where both its pages are visible at once, but on mobile only one
   * leaf (`mobileSide`) is on screen at a time. So on mobile, "next"/"previous" first flips within
   * the current spread (same `NotebookPageTurn`, `single` this time) and only reaches for `turn`
   * once that leaf is the one already facing the edge it's headed toward — a phone reader sees
   * every page in the order a real book gives them, not two at a stride.
   */
  const goPage = useCallback(
    (dir: 1 | -1) => {
      if (isMobile && view.kind === "spread") {
        const atSpreadEdge =
          dir > 0 ? mobileSide === "right" : mobileSide === "left";
        if (!atSpreadEdge) {
          startSlide(dir);
          setMobileSide(dir > 0 ? "right" : "left");
          return;
        }
      }
      turn(dir);
      if (isMobile) setMobileSide(dir > 0 ? "left" : "right");
    },
    [isMobile, view, mobileSide, startSlide, turn],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goPage(1);
      if (event.key === "ArrowLeft") goPage(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPage]);

  /**
   * Click a rail icon: switch to it and open the panel, or collapse it if it was already active.
   *
   * `setDetailCollapsed` must NOT be called from inside `setActivePanel`'s updater — it was, and
   * that's an impure updater (a state updater calling another setState as a side effect). React
   * dev-mode Strict Mode double-invokes updater functions to catch exactly this, and a *toggle*
   * inside one cancels itself out on the double call (true→false→true), while a same-value call
   * doesn't. `activePanel` defaults to `"add"`, the rail's own first category, so the very first
   * click on "Ekle" always took the toggle branch — and always silently failed to open. Clicking
   * any other category first took the (idempotent) switch branch, worked, and *then* "Ekle" took
   * the switch branch too and worked — exactly the "only works the second time" the bug reported.
   */
  const openCategory = useCallback(
    (id: NotebookPanelCategory) => {
      /*
       * "Çiz" is a mode, not a panel, so it toggles rather than expanding: tapping it again puts
       * the pen down and hands the pages back to the arranging tools. It also always collapses the
       * side panel, because it has no body to show there and the notebook wants the width.
       *
       * Selection is cleared on the way in: a selection outline hanging over a page you are now
       * drawing on is a control you cannot reach, since the stage stops taking pointers.
       */
      if (id === "draw") {
        const leaving = activePanel === "draw";
        setActivePanel(leaving ? "add" : "draw");
        setDetailCollapsed(true);
        if (!leaving) {
          leftPage.dispatch({ type: "select", id: null });
          rightPage.dispatch({ type: "select", id: null });
          setEditingText(null);
          setMobileRailOpen(false);
        }
        return;
      }
      if (activePanel === id) {
        setDetailCollapsed((collapsed) => !collapsed);
      } else {
        setActivePanel(id);
        setDetailCollapsed(false);
      }
    },
    [activePanel, leftPage, rightPage],
  );

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
    // Mirrors the vision board opening its "Metin" category the moment a text item exists — the
    // font/size/plate/spacing controls show up right alongside the in-place typing box.
    setActivePanel("text");
    setDetailCollapsed(false);
  }, [focused, focusedSide]);

  /**
   * Selecting an item on either page — same shape as the vision board's own `handleSelect`. A text
   * item auto-opens the panel's "text" category so its controls are one glance away, exactly like
   * `handleAddNote` above; any other kind (or clearing selection) leaves whatever category is
   * already open alone, since neither entries nor stickers have panel controls of their own here.
   */
  const handleSelect = useCallback(
    (side: Side, id: string | null) => {
      setFocusedSide(side);
      const hook = side === "left" ? leftPage : rightPage;
      hook.dispatch({ type: "select", id });
      const item = id
        ? hook.state.doc.items.find((candidate) => candidate.id === id)
        : null;
      if (item?.kind === "text") {
        setActivePanel("text");
        setDetailCollapsed(false);
      }
    },
    [leftPage, rightPage],
  );

  const handleTextPatch = useCallback(
    (patch: Partial<VisionBoardTextItem>) => {
      if (focused.selected?.kind === "text")
        focused.patch(focused.selected.id, patch);
    },
    [focused],
  );

  const handleTextEditDone = useCallback(() => {
    setEditingText((current) => {
      if (!current) return current;
      const hook = current.side === "left" ? leftPage : rightPage;
      const item = hook.state.doc.items.find(
        (candidate) => candidate.id === current.id,
      );
      if (item && item.kind === "text" && !item.text.trim()) {
        hook.dispatch({ type: "remove", id: current.id });
      }
      return null;
    });
  }, [leftPage, rightPage]);

  /**
   * The entry behind an item on a page, or null for anything that is not an entry card.
   *
   * The page document stores placement and an `entryId`; the meta that came with the page stores
   * what that id means. Two callers need the join — opening a card and offering to study it — and
   * neither should be resolving ids inline.
   */
  const entryForItem = useCallback(
    (side: Side, item: NotebookPageItem): NotebookEntryDto | null => {
      if (item.kind !== "entry") return null;
      const meta = side === "left" ? leftMeta : rightMeta;
      return meta?.entries.find((entry) => entry.id === item.entryId) ?? null;
    },
    [leftMeta, rightMeta],
  );

  /**
   * The "study this card" button the selection overlay draws under a selected entry.
   *
   * Double-clicking the card has always opened it, and nobody has ever found that. Only entry
   * items get one — a sticker or a note has nothing to review.
   */
  const studyActionFor = useCallback(
    (side: Side, item: NotebookPageItem) => {
      const entry = entryForItem(side, item);
      if (!entry) return undefined;
      return {
        label: t("item_study"),
        icon: <History aria-hidden size={13} />,
        onClick: () => setSingleReview(entry),
      };
    },
    [entryForItem, t],
  );

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
  /** The placement itself, without deciding what the side panel should do afterwards. */
  const placeEntryOnPage = useCallback(
    (entry: NotebookEntryDto, aspect: number | null) => {
      const slot = nextEntrySlot(focused.state.doc.items, aspect);
      if (!slot) {
        setError(t("error_page_full"));
        return;
      }
      focused.dispatch({
        type: "add",
        item: {
          ...slot,
          id: crypto.randomUUID(),
          kind: "entry",
          entryId: entry.id,
          opacity: 1,
        },
      });
      const setMeta = focusedSide === "left" ? setLeftMeta : setRightMeta;
      setMeta((current) =>
        current
          ? { ...current, entries: [...current.entries, entry] }
          : current,
      );
    },
    [focused, focusedSide, t],
  );

  const handleCreated = useCallback(
    (entry: NotebookEntryDto, aspect: number | null) => {
      placeEntryOnPage(entry, aspect);
      // The add form is finished with, so get out of the way and show the card that just landed.
      // Placing from the index is the opposite: the student is browsing a list and may well place
      // another, so that path deliberately leaves the panel open.
      setDetailCollapsed(true);

      /*
       * Say when the card comes back.
       *
       * Filing a mistake scheduled it two days out and told nobody, so the review deck stayed empty
       * and the feature read as broken: "I added a question and nothing happened." The card was
       * always there, waiting for the gap that makes the recall worth measuring — this is that gap,
       * said out loud. The action is for the student who does not want to wait; it opens the card
       * now, and answering it early cannot promote it (the server reads the card's own due date).
       */
      const feedback = reviewFeedback(entry);
      if (feedback?.kind !== "due") return;
      toast.success({
        title: t("add_scheduled_title"),
        message: t("add_scheduled_message", { days: feedback.days }),
        action: {
          label: t("add_scheduled_study"),
          onClick: () => setSingleReview(entry),
        },
      });
    },
    [placeEntryOnPage, t, toast],
  );

  /**
   * A reviewed entry is patched in place rather than refetched: whichever side's page holds the
   * card already knows it, and the server's answer is the whole new state of it. This is what
   * makes a healed card fade on the wall the moment it heals, on whichever side it sits.
   */
  const handleEntryPatched = useCallback((updated: NotebookEntryDto) => {
    setIndexRefreshKey((key) => key + 1);
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
  }, []);

  /**
   * A card the student removed from the book for good.
   *
   * Four places hold a copy of it and every one has to let go, or the deletion is only half real:
   * the due list would keep offering it, the counters would keep counting it, the page metas would
   * keep resolving it — and the page document would keep a card item pointing at an entry that no
   * longer exists. `StageItem` renders that item as nothing, so it does not break the page; it
   * leaves an invisible box that still selects and drags, which is worse than a broken card because
   * nobody can see what they are grabbing.
   */
  const handleEntryDeleted = useCallback(
    (entryId: string) => {
      let wasDue = false;
      setDue((current) => {
        wasDue = current.some((entry) => entry.id === entryId);
        return current.filter((entry) => entry.id !== entryId);
      });

      const dropFromMeta = (meta: NotebookPageDto | null) =>
        meta && meta.entries.some((entry) => entry.id === entryId)
          ? {
              ...meta,
              entries: meta.entries.filter((entry) => entry.id !== entryId),
            }
          : meta;
      setLeftMeta(dropFromMeta);
      setRightMeta(dropFromMeta);

      for (const hook of [leftPage, rightPage]) {
        const item = hook.state.doc.items.find(
          (candidate) =>
            candidate.kind === "entry" && candidate.entryId === entryId,
        );
        if (item) hook.dispatch({ type: "remove", id: item.id });
      }

      setOverview((current) =>
        current
          ? {
              ...current,
              entryCount: Math.max(0, current.entryCount - 1),
              dueCount: wasDue
                ? Math.max(0, current.dueCount - 1)
                : current.dueCount,
            }
          : current,
      );
      setSingleReview(null);
      setEditingEntry(null);
      setIndexRefreshKey((key) => key + 1);
    },
    [leftPage, rightPage],
  );

  /** Ids already on one of the two open pages — what the index checks before offering to place. */
  const placedEntryIds = new Set(
    [...leftPage.state.doc.items, ...rightPage.state.doc.items].flatMap(
      (item) => (item.kind === "entry" ? [item.entryId] : []),
    ),
  );

  /**
   * Put an already-filed entry onto the focused page from the index.
   *
   * Same landing as a freshly created one — `handleCreated` owns slot choice and the page-full
   * message — but the aspect has to be measured from the stored photo rather than the upload that
   * is no longer happening. A failed measurement is not an error: `nextEntrySlot` falls back to its
   * own default height, which is exactly what a text-only entry gets.
   */
  const handlePlaceEntry = useCallback(
    async (entry: NotebookEntryDto) => {
      const aspect = entry.url
        ? await measureImageAspect(entry.url).catch(() => null)
        : null;
      placeEntryOnPage(entry, aspect);
    },
    [placeEntryOnPage],
  );

  /** Persist book-level cover metadata independently from page autosave. */
  const handleCover = useCallback(
    async (next: NotebookCoverDoc) => {
      const id = overview?.notebook.id;
      if (!id) return;
      const previous = cover;
      setCover(next);
      try {
        const updated = await updateNotebook(id, {
          title: next.title?.trim() || null,
          cover: { color: next.color, material: next.material },
        });
        setOverview((current) =>
          current ? { ...current, notebook: updated } : current,
        );
        setCover({ ...updated.cover, title: updated.title });
      } catch {
        setCover(previous);
        setError(t("error_save"));
      }
    },
    [cover, overview?.notebook.id, t],
  );

  const handleReviewed = useCallback(
    (updated: NotebookEntryDto) => {
      // Only a card that was actually due leaves the day's counter. Answering one early — opened
      // from a page, or picked for a study session — used to tick the counter down too, so the
      // notebook reported clearing a card from a deck it had never been in.
      const wasDue = due.some((entry) => entry.id === updated.id);
      setDue((current) => current.filter((entry) => entry.id !== updated.id));
      handleEntryPatched(updated);
      setOverview((current) =>
        current
          ? {
              ...current,
              dueCount: wasDue
                ? Math.max(0, current.dueCount - 1)
                : current.dueCount,
              healedCount:
                updated.status === "HEALED"
                  ? current.healedCount + 1
                  : current.healedCount,
            }
          : current,
      );
    },
    [due, handleEntryPatched],
  );

  if (!overview && !error) return <NotebookContentSkeleton />;

  const dueIds = new Set(due.map((entry) => entry.id));
  const isSpread = view.kind === "spread";
  /**
   * Draw mode. While it is on, the item stage is handed no pointer callbacks at all, which is what
   * makes it non-interactive (`NotebookPageStage` derives that from the props it receives) and
   * lets the ink layer above it take every pointer instead. One flag, checked at three stage
   * sites: the mobile leaf and the two pages of a spread.
   */
  const drawing = isSpread && activePanel === "draw";
  const notingHere =
    editingText != null &&
    editingText.side === (isMobile ? mobileSide : focusedSide);
  /**
   * One rail highlight at a time so the layoutId pill can travel. "Not" is not a category — it
   * only owns the pill while its inline editor is open AND no other category panel is showing
   * (the text panel has no rail icon of its own). Draw always wins: it is a mode, not a panel.
   */
  const activeRail: NotebookPanelCategory | "note" | null =
    activePanel === "draw"
      ? "draw"
      : notingHere && (detailCollapsed || activePanel === "text")
        ? "note"
        : !detailCollapsed && activePanel !== "text"
          ? activePanel
          : null;
  /*
   * The spread itself no longer moves — `NotebookPageTurn` is what the eye follows, and a page that
   * also slid underneath its own turning leaf would read as two animations fighting.
   *
   * ponytail: both sides crossfade over the leaf's own duration, so the swap is at its most visible
   * near the midpoint — which is exactly when the leaf is standing over the spine covering it. Strictly
   * true to a real book, the *revealed* side should change at t=0 and the *covered* side only at t=0.5;
   * doing that means holding the outgoing page's document alongside the incoming one for the length of
   * the turn. Worth it only if the half-beat ever actually reads as wrong.
   */
  const spreadVariants = {
    enter: { opacity: 0, zIndex: 2 },
    center: { opacity: 1, zIndex: 2 },
    exit: { opacity: 0, zIndex: 1 },
  };
  const spreadFade = reduceMotion
    ? { duration: 0.15 }
    : isMobile
      ? // Instant on mobile. The crossfade exists to hide the swap under a turning leaf, and there
        // is no leaf here — the pages slide past each other, and a fade on top of a slide is two
        // transitions competing to describe the same move.
        { duration: 0 }
      : { duration: PAGE_TURN_SECONDS * 0.8, ease: "easeInOut" as const };
  const pageLabel = !isSpread
    ? t("cover_label")
    : isMobile
      ? t("page_label", { page: view.left + (mobileSide === "left" ? 1 : 2) })
      : t("page_range_label", { from: view.left + 1, to: view.left + 2 });
  /** The single page mobile shows — derived once here rather than repeated in every prop below. */
  const mobilePage = mobileSide === "left" ? leftPage : rightPage;
  const mobileGesture = mobileSide === "left" ? leftGesture : rightGesture;
  const mobileInk = mobileSide === "left" ? leftInk : rightInk;
  const mobileMeta = mobileSide === "left" ? leftMeta : rightMeta;

  const notebookRatio =
    isSpread && !isMobile
      ? (NOTEBOOK_PAGE_CANVAS.width * 2 + SPINE_GUTTER) /
        NOTEBOOK_PAGE_CANVAS.height
      : NOTEBOOK_PAGE_CANVAS.width / NOTEBOOK_PAGE_CANVAS.height;
  const notebookMaxWidthPx = isSpread
    ? isMobile
      ? MOBILE_LEAF_MAX_WIDTH_PX
      : NOTEBOOK_MAX_WIDTH_PX
    : COVER_MAX_WIDTH_PX;
  // Zero until the outer box's first real measurement lands — `fitWithin` would otherwise divide a
  // real ratio into a 0×0 box and render nothing for that first frame, which reads as a flash.
  const fitted =
    fitBox.width > 0 && fitBox.height > 0
      ? fitWithin(fitBox, notebookRatio, notebookMaxWidthPx)
      : { width: fitBox.width, height: fitBox.height };

  const railButtons = (
    <>
      {RAIL_CATEGORIES.filter(
        ({ id }) => !notebookId || (id !== "add" && id !== "index"),
      ).map(({ id, icon: Icon, labelKey }) => {
        const active = activeRail === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => openCategory(id)}
            className="relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0 rounded-[var(--radius-card)] px-0 py-1 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] lg:w-full lg:flex-none lg:gap-0.5 lg:px-1 lg:py-1.5"
            style={{
              color: active
                ? "var(--color-btn-label)"
                : "var(--color-secondary)",
            }}
          >
            {active ? (
              <NotebookRailActiveFill reduceMotion={reduceMotion} />
            ) : null}
            <Icon aria-hidden size={20} className="relative z-[1]" />
            <span className="relative z-[1] w-full truncate text-center leading-none">
              {t(labelKey)}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        aria-pressed={activeRail === "note"}
        onClick={handleAddNote}
        className="relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0 rounded-[var(--radius-card)] px-0 py-1 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] lg:w-full lg:flex-none lg:gap-0.5 lg:px-1 lg:py-1.5"
        style={{
          color:
            activeRail === "note"
              ? "var(--color-btn-label)"
              : "var(--color-secondary)",
        }}
      >
        {activeRail === "note" ? (
          <NotebookRailActiveFill reduceMotion={reduceMotion} />
        ) : null}
        <StickyNote aria-hidden size={20} className="relative z-[1]" />
        <span className="relative z-[1] w-full truncate text-center leading-none">
          {t("sidebar_note")}
        </span>
      </button>
    </>
  );

  const dueChip =
    overview && overview.dueCount > 0 ? (
      <button
        type="button"
        onClick={() => setReviewing(true)}
        className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 shadow-[var(--shadow-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ backgroundColor: "var(--color-accent-soft)" }}
      >
        <History
          aria-hidden
          size={16}
          style={{ color: "var(--color-accent)" }}
        />
        <span
          className="text-sm font-bold"
          style={{ color: "var(--color-main)" }}
        >
          {t("due_strip", { count: overview.dueCount })}
        </span>
      </button>
    ) : null;

  const undoButton = (
    <button
      type="button"
      aria-label={t("edit_undo")}
      disabled={!focused.canUndo}
      onClick={() => focused.dispatch({ type: "undo" })}
      className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-[var(--color-surface-container)] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{
        color: "var(--color-main)",
        backgroundColor: "var(--color-surface)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <Undo2 aria-hidden size={17} />
    </button>
  );

  const deleteButton = (
    <button
      type="button"
      aria-label={t("edit_delete")}
      disabled={focused.selected == null}
      onClick={() => {
        const item = focused.selected;
        if (!item) return;
        if (item.kind !== "entry") {
          focused.dispatch({ type: "remove", id: item.id });
          return;
        }
        const meta = focused === leftPage ? leftMeta : rightMeta;
        const entry = meta?.entries.find(
          (candidate) => candidate.id === item.entryId,
        );
        if (!entry) {
          focused.dispatch({ type: "remove", id: item.id });
          return;
        }
        setRemovingItem({ itemId: item.id, entry });
      }}
      className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-[var(--color-surface-container)] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{
        color: "var(--color-main)",
        backgroundColor: "var(--color-surface)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <Trash2 aria-hidden size={17} />
    </button>
  );

  const saveButton = (
    <button
      type="button"
      disabled={saving || (!leftPage.state.dirty && !rightPage.state.dirty)}
      aria-busy={saving || undefined}
      onClick={() => void saveNow()}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[var(--color-btn-label)] outline-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{
        backgroundColor: "var(--color-btn)",
        boxShadow: "var(--shadow-card)",
      }}
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
  );

  const pageNav = (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        aria-label={t("previous_page")}
        onClick={() => goPage(-1)}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{
          borderColor:
            "color-mix(in srgb, var(--color-main) 15%, transparent)",
          color: "var(--color-main)",
          backgroundColor: "var(--color-surface)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <ChevronLeft aria-hidden size={18} />
      </button>
      <span
        className="rounded-full px-2 py-1 text-sm tabular-nums"
        style={{
          color: "var(--color-secondary)",
          backgroundColor: "var(--color-surface)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {pageLabel}
      </span>
      <button
        type="button"
        aria-label={t("next_page")}
        onClick={() => goPage(1)}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{
          borderColor:
            "color-mix(in srgb, var(--color-main) 15%, transparent)",
          color: "var(--color-main)",
          backgroundColor: "var(--color-surface)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <ChevronRight aria-hidden size={18} />
      </button>
    </div>
  );

  return (
    /*
     * A definite height on desktop, not just a floor.
     *
     * `min-h` alone is why the page scrolled: `useFitSize` measures a box further down and
     * `fitWithin` sizes the spread to fit *its height* — with no ceiling anywhere above it that
     * height is whatever the book asks for, so the fit only ever binds on width and the book runs
     * off the bottom of the window. The whole fitting machinery is there to stop exactly that, and
     * it needs one real number to work from. This is that number.
     *
     * It also gives the side panel a height to divide, which is what makes its `overflow-y-auto`
     * live rather than decorative.
     *
     * Mobile keeps the floor: there the panel is a half-height sheet and the page really does scroll.
     */
    <div
      className={`flex flex-col gap-2 p-2 overflow-hidden ${MOBILE_BELOW_APP_CHROME_HEIGHT_CLASS}`}
    >
      <FormError message={error} />

      {reviewing ? (
        <NotebookReviewPanel
          entries={due}
          onReviewed={handleReviewed}
          onEntryUpdated={handleEntryPatched}
          onClose={() => setReviewing(false)}
        />
      ) : studyDeck ? (
        <NotebookReviewPanel
          entries={studyDeck}
          // No auto-close and no `onEdit`: this is a deck, and the panel walks it to the end the
          // same way it walks the due one.
          onReviewed={handleReviewed}
          onEntryUpdated={handleEntryPatched}
          onClose={() => setStudyDeck(null)}
        />
      ) : singleReview ? (
        <NotebookReviewPanel
          entries={[singleReview]}
          onReviewed={(updated) => {
            handleReviewed(updated);
            setSingleReview(null);
          }}
          onEntryUpdated={handleEntryPatched}
          // Only here, never on the due deck: correcting a card's filing belongs to looking at that
          // one card, and a destructive action has no business in a review session.
          onEdit={setEditingEntry}
          onClose={() => setSingleReview(null)}
        />
      ) : null}

      {editingEntry && exam ? (
        <NotebookEntryEditDialog
          entry={editingEntry}
          subjects={exam.subjects}
          topics={exam.topics}
          onSaved={(updated) => {
            handleEntryPatched(updated);
            setSingleReview((current) =>
              current && current.id === updated.id ? updated : current,
            );
            setEditingEntry(null);
          }}
          onDeleted={handleEntryDeleted}
          onClose={() => setEditingEntry(null)}
        />
      ) : null}

      {removingItem ? (
        <NotebookRemoveChoiceDialog
          onRemoveFromPage={() => {
            const hook = leftPage.state.doc.items.some(
              (item) => item.id === removingItem.itemId,
            )
              ? leftPage
              : rightPage;
            hook.dispatch({ type: "remove", id: removingItem.itemId });
            setRemovingItem(null);
          }}
          onDeleteEntry={async () => {
            await deleteNotebookEntry(removingItem.entry.id);
            handleEntryDeleted(removingItem.entry.id);
            setRemovingItem(null);
          }}
          onClose={() => setRemovingItem(null)}
        />
      ) : null}

      <NotebookImageLightbox
        entry={previewEntry}
        onClose={() => setPreviewEntry(null)}
      />

      <div className="relative flex min-h-0 flex-1 flex-col gap-2">
        {/*
          Icon rail + expandable panel. Desktop: overlay on the book so opening a tool does not
          shrink the page. Mobile: in-flow strip above the book — overlaying a phone-sized leaf
          would cover the writing surface.
        */}
        {isSpread ? (
          <>
            {isMobile ? (
              <div className="flex shrink-0 flex-col gap-2">
                <NotebookMobileToolRail
                  open={mobileRailOpen}
                  reduceMotion={reduceMotion}
                  navLabel={t("sidebar_nav")}
                  showLabel={t("draw.show_tools")}
                  hideLabel={t("draw.hide_tools")}
                  onOpen={() => setMobileRailOpen(true)}
                  onClose={() => setMobileRailOpen(false)}
                >
                  <LayoutGroup id="notebook-rail">{railButtons}</LayoutGroup>
                </NotebookMobileToolRail>
                <div className="flex flex-wrap items-center gap-2">
                  {dueChip}
                  <div className="ms-auto flex shrink-0 items-center gap-1">
                    {undoButton}
                    {deleteButton}
                    {saveButton}
                  </div>
                </div>
              </div>
            ) : (
              <LayoutGroup id="notebook-rail">
                <nav
                  aria-label={t("sidebar_nav")}
                  className={`mentor-scrollarea flex shrink-0 gap-0 overflow-x-auto border px-1 py-1 lg:absolute lg:top-1/2 lg:left-2 lg:w-16 lg:-translate-y-1/2 lg:flex-col lg:gap-1 lg:overflow-x-visible lg:overflow-y-auto lg:px-1 lg:py-3 lg:shadow-[var(--shadow-card)] ${NOTEBOOK_TRAY_RADIUS_CLASS}`}
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderColor:
                      "color-mix(in srgb, var(--color-main) 10%, transparent)",
                    zIndex: NOTEBOOK_Z.rail,
                  }}
                >
                  {railButtons}
                </nav>
              </LayoutGroup>
            )}

            <AnimatePresence initial={false}>
              {!detailCollapsed ? (
                <motion.aside
                  key="notebook-detail-panel"
                  initial={
                    reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }
                  }
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                  transition={boardChromeTransition}
                  /*
                    A ceiling on the panel, not on the page.
                    `lg:max-h-none` let a long list grow the whole shell — the page has a floor
                    (`min-h-[100dvh]`) and no ceiling, so nothing downstream had a height to divide
                    and every `overflow-y-auto` under here was dead code.
                    The ceiling belongs here rather than on the shell: the shell's height is what
                    `useFitSize` measures to fit the spread, and capping *that* made the measurement
                    collapse to the fallback width — the book rendered at its max size and got
                    clipped top and bottom by the very overflow rule meant to tame the panel.
                    Bounding the panel alone leaves the book's sizing exactly as it was.
                  */
                  className="relative flex min-h-0 max-h-[50vh] w-full shrink-0 flex-col rounded-[var(--radius-card)] border lg:absolute lg:top-2 lg:bottom-2 lg:left-20 lg:max-h-none lg:w-96 lg:shadow-[var(--shadow-card)]"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderColor:
                      "color-mix(in srgb, var(--color-main) 10%, transparent)",
                    zIndex: NOTEBOOK_Z.panel,
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
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={activePanel}
                        initial={
                          reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }
                        }
                        animate={
                          reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
                        }
                        exit={
                          reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }
                        }
                        transition={boardChromeFastTransition}
                        className="h-full"
                      >
                        <NotebookSidePanel
                          category={activePanel}
                          paper={focused.state.doc.paper}
                          cover={cover}
                          onCover={(next) => void handleCover(next)}
                          exam={exam}
                          mockExamId={mockExamId}
                          placedEntryIds={placedEntryIds}
                          indexRefreshKey={indexRefreshKey}
                          onOpenEntry={setSingleReview}
                          onStudyEntries={setStudyDeck}
                          onPlaceEntry={(entry) => void handlePlaceEntry(entry)}
                          selectedText={
                            focused.selected?.kind === "text"
                              ? focused.selected
                              : null
                          }
                          onCreated={handleCreated}
                          onAddSticker={(asset) =>
                            focused.dispatch({
                              type: "add",
                              item: createStickerItem(
                                asset,
                                focused.state.doc.items,
                              ),
                            })
                          }
                          onSetPaper={(paper) =>
                            focused.dispatch({ type: "setPaper", paper })
                          }
                          onPatchText={handleTextPatch}
                          onCheckpoint={focused.checkpoint}
                          onCollapse={() => setDetailCollapsed(true)}
                        />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.aside>
              ) : null}
            </AnimatePresence>
          </>
        ) : isMobile && dueChip ? (
          <div className="flex shrink-0">{dueChip}</div>
        ) : null}

        {/*
          Desktop chrome overlays the book. Mobile: pen + due/save sit above the leaf; pager
          uses the gap above the tab bar so page arrows do not cover cards.
        */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center">
          {/*
            Two boxes, two different jobs. The OUTER box is a flex item (`flex-1 min-h-0`, width
            forced to `w-full` since the column's `items-center` would otherwise shrink-wrap it):
            it receives a real, fully definite width AND height from flexbox. `fitRef` measures
            that box. The INNER box's `maxWidth` is the `fitWithin` result; `aspectRatio` derives
            height from that already-definite width.
          */}
          <div
            ref={fitRef}
            className="flex w-full min-h-0 flex-1 items-center justify-center"
          >
            <div
              className="relative w-full select-none"
              style={{
                // `width: 100%` of the OUTER box, capped at the measured-fit value — never `auto`,
                // so this can never collapse to 0 the way two `auto` dimensions did. `aspectRatio`
                // only ever derives the HEIGHT from that already-definite width.
                maxWidth: fitted.width || notebookMaxWidthPx,
                aspectRatio: notebookRatio,
                /*
                 * The height limit CSS can enforce on its own, and the measurement cannot.
                 *
                 * `maxWidth` only fits the book when `fitted.width` holds a real number; until the
                 * first measurement lands — or if it never does — the fallback is a fixed pixel
                 * ceiling that knows nothing about the window, and the book renders taller than the
                 * space it is in. That is the state the notebook was stuck in: the spread filled the
                 * viewport and ignored the margin above it, because the margin only ever shrank the
                 * box being measured, and no measurement was reaching the width.
                 *
                 * With `aspect-ratio` set, `max-height` shrinks the width with it, so the ratio
                 * survives. It makes the fit a property of the layout rather than of a hook: the
                 * book cannot outgrow its container even for one frame, and the padding around it
                 * finally means something.
                 */
                maxHeight: "100%",
                // The depth the cover swings through. The turning leaf carries its own, tighter one.
                perspective: reduceMotion ? undefined : 1800,
              }}
            >
              {!isMobile && dueChip ? (
                <div
                  className="absolute top-2 left-2"
                  style={{ zIndex: NOTEBOOK_Z.overlay }}
                >
                  {dueChip}
                </div>
              ) : null}

              {isSpread && !isMobile ? (
                <div
                  className="pointer-events-none absolute inset-x-0 top-2 flex items-start justify-end gap-1 px-2 [&>*]:pointer-events-auto"
                  style={{ zIndex: NOTEBOOK_Z.overlay }}
                >
                  {undoButton}
                  {deleteButton}
                  <div className="flex items-center gap-2">
                    {leftPage.state.dirty || rightPage.state.dirty ? (
                      <span
                        className="rounded-full px-2 py-1 text-xs"
                        style={{
                          color: "var(--color-secondary)",
                          backgroundColor: "var(--color-surface)",
                          boxShadow: "var(--shadow-card)",
                        }}
                      >
                        {t("unsaved")}
                      </span>
                    ) : null}
                    {saveButton}
                  </div>
                </div>
              ) : null}

              {/*
              Floats over the notebook's own top edge rather than sitting in flow above it (pushed
              the whole book down and shrank it — `useFitSize` measures the OUTER box, so a taller
              toolbar row meant a shorter notebook the instant draw mode turned on) or pinned over
              the bottom (clipped off-screen there against the pagination row + safe-area inset).
              The top of the notebook has neither problem: nothing else anchors there, so the tray
              can overlap it for free. `pointer-events-none` on the wrapper keeps the empty space
              either side of the tray from stealing taps meant for the page underneath.
            */}
              <AnimatePresence>
                {drawing ? (
                  <div
                    key="ink-toolbar"
                    className={
                      isMobile
                        ? "pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2"
                        : "pointer-events-none absolute inset-x-0 top-14 flex justify-center px-2 sm:top-16"
                    }
                    style={{ zIndex: NOTEBOOK_Z.ink }}
                  >
                    <NotebookInkToolbar
                      tool={ink.tool}
                      color={ink.color}
                      size={ink.size}
                      opacity={ink.opacity}
                      canUndo={focused.canUndo}
                      canRedo={focused.canRedo}
                      hasInk={focused.state.doc.ink.length > 0}
                      onToolChange={ink.changeTool}
                      onColorChange={ink.setColor}
                      onSizeChange={ink.setSize}
                      onOpacityChange={ink.setOpacity}
                      onUndo={() => focused.dispatch({ type: "undo" })}
                      onRedo={() => focused.dispatch({ type: "redo" })}
                      onClear={() => focused.dispatch({ type: "clearInk" })}
                    />
                  </div>
                ) : null}
              </AnimatePresence>

              {/*
              Two nested regions on purpose. The outer one, here, only ever swaps cover↔spread — a
              structural change, so `mode="wait"` holds the incoming half back until the outgoing
              one has left, rather than letting them overlap while the aspect ratio jumps from one
              page wide to two. The inner one swaps the page contents *within* an open book, under
              the leaf that `NotebookPageTurn` flies over them.

              The cover is hinged where a real one is — its spine, the left edge — and swings through
              the same axis the leaves do, so opening the book and turning a page read as one object.
              Closing runs the identical arc backwards.
            */}
              <AnimatePresence initial={false} mode="wait">
                {view.kind === "cover" ? (
                  <motion.div
                    key="cover"
                    initial={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, rotateY: -105 }
                    }
                    animate={{ opacity: 1, rotateY: 0 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, rotateY: -105 }
                    }
                    transition={{
                      duration: reduceMotion ? 0.15 : 0.45,
                      ease: [0.45, 0.05, 0.25, 1],
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      transformOrigin: "left center",
                      transformStyle: reduceMotion ? undefined : "preserve-3d",
                    }}
                  >
                    <NotebookCover
                      cover={cover}
                      title={
                        cover?.title?.trim() ||
                        overview?.notebook.title ||
                        t("cover_title")
                      }
                      subtitle={
                        notebookId
                          ? t("cover_custom_subtitle", {
                              pages: overview?.pageCount ?? 0,
                            })
                          : t("cover_subtitle", {
                              entries: overview?.entryCount ?? 0,
                              healed: overview?.healedCount ?? 0,
                            })
                      }
                      onOpen={() => goPage(1)}
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
                    // Clips both the drag-turn spread and the flying leaf to the notebook's own box.
                    // The leaf's 3D rotation (`NotebookPageTurn`) has no clip of its own — without this,
                    // its mid-turn ink overflow reads as oversized and can even push the page to scroll.
                    style={{
                      position: "absolute",
                      inset: 0,
                      overflow: "hidden",
                    }}
                  >
                    {/* The page that just left, held still and slid off. Rendered outside the
                        presence below on purpose: that one swaps a live subtree, and a live subtree
                        cannot show the old page — `mobilePage` has already switched to the other
                        side's document by the time this runs. This is a photograph of it. No pointer
                        callbacks reach the stage, which is what makes it inert (`NotebookPageStage`
                        derives that from the props it receives). */}
                    {isMobile && outgoing ? (
                      <motion.div
                        key={`outgoing-${outgoing.seq}`}
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{ zIndex: 3 }}
                        initial={{ x: 0 }}
                        animate={{ x: outgoing.dir > 0 ? "-100%" : "100%" }}
                        transition={MOBILE_SLIDE}
                        onAnimationComplete={() =>
                          setOutgoing((current) =>
                            current?.seq === outgoing.seq ? null : current,
                          )
                        }
                      >
                        <NotebookPageSurface paper={outgoing.doc.paper}>
                          <NotebookPageStage
                            items={outgoing.doc.items}
                            entries={outgoing.entries}
                            dueIds={dueIds}
                          />
                          <NotebookInkLayer strokes={outgoing.doc.ink} />
                        </NotebookPageSurface>
                      </motion.div>
                    ) : null}

                    <AnimatePresence initial={false}>
                      <motion.div
                        // Mobile's key also carries `mobileSide`: flipping within a spread has no
                        // `view` change of its own to key off, so without it the crossfade would
                        // never retrigger for that move.
                        key={
                          isMobile
                            ? `spread-${view.left}-${mobileSide}`
                            : `spread-${view.left}`
                        }
                        variants={spreadVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={spreadFade}
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                        }}
                      >
                        {isMobile ? (
                          <motion.div
                            className="h-full w-full"
                            // No entrance on the very first render, and none when nothing is
                            // leaving: `false` means "start where you are", which is what a page
                            // that was not reached by turning should do.
                            initial={
                              outgoing
                                ? { x: outgoing.dir > 0 ? "100%" : "-100%" }
                                : false
                            }
                            animate={{ x: 0 }}
                            transition={MOBILE_SLIDE}
                          >
                            <NotebookPageSurface
                              paper={mobilePage.state.doc.paper}
                            >
                              <NotebookPageStage
                                items={mobilePage.state.doc.items}
                                entries={mobileMeta?.entries ?? []}
                                dueIds={dueIds}
                                selectedId={mobilePage.state.selectedId}
                                contentHiddenId={
                                  editingText?.side === mobileSide
                                    ? editingText.id
                                    : null
                                }
                                onSelect={
                                  drawing
                                    ? undefined
                                    : (id) => handleSelect(mobileSide, id)
                                }
                                onItemPointerDown={
                                  drawing
                                    ? undefined
                                    : (event, item) =>
                                        mobileGesture.begin(event, item, {
                                          kind: "move",
                                        })
                                }
                                onItemDoubleClick={(item) =>
                                  handleItemDoubleClick(mobileSide, item)
                                }
                                onPreviewImage={setPreviewEntry}
                                onPointerMove={mobileGesture.move}
                                onPointerUp={mobileGesture.end}
                                renderOverlay={(item) =>
                                  item.kind === "text" &&
                                  editingText?.side === mobileSide &&
                                  editingText.id === item.id ? (
                                    <NotebookTextInlineEditor
                                      item={item}
                                      label={t("edit_note_label")}
                                      onChange={(text) =>
                                        mobilePage.patch(item.id, { text })
                                      }
                                      onDone={handleTextEditDone}
                                    />
                                  ) : (
                                    <SelectionOverlay
                                      resizeHandlers={(corner) =>
                                        mobileGesture.handlersFor(item, {
                                          kind: "resize",
                                          corner,
                                        })
                                      }
                                      rotateHandlers={mobileGesture.handlersFor(
                                        item,
                                        {
                                          kind: "rotate",
                                        },
                                      )}
                                      resizeLabel={t("edit_resize")}
                                      rotateLabel={t("edit_rotate")}
                                      action={studyActionFor(mobileSide, item)}
                                    />
                                  )
                                }
                              />
                              {/* Above the stage: ink annotates what is on the page, so it draws
                                over the cards rather than under them. */}
                              <NotebookInkLayer
                                strokes={mobilePage.state.doc.ink}
                                liveStroke={mobileInk.liveStroke}
                                erasing={mobileInk.erasing}
                                onPointerDown={
                                  drawing ? mobileInk.begin : undefined
                                }
                                onPointerMove={
                                  drawing ? mobileInk.move : undefined
                                }
                                onPointerUp={
                                  drawing ? mobileInk.end : undefined
                                }
                              />
                            </NotebookPageSurface>
                          </motion.div>
                        ) : (
                          <>
                            {/* Bound on its right edge: this page's punched margin faces the spine. */}
                            <div
                              className="h-full"
                              style={{ width: `${PAGE_PERCENT}%` }}
                            >
                              <NotebookPageSurface
                                paper={leftPage.state.doc.paper}
                                binding="right"
                                coil={false}
                              >
                                <NotebookPageStage
                                  items={leftPage.state.doc.items}
                                  entries={leftMeta?.entries ?? []}
                                  dueIds={dueIds}
                                  selectedId={leftPage.state.selectedId}
                                  contentHiddenId={
                                    editingText?.side === "left"
                                      ? editingText.id
                                      : null
                                  }
                                  onSelect={
                                    drawing
                                      ? undefined
                                      : (id) => handleSelect("left", id)
                                  }
                                  onItemPointerDown={
                                    drawing
                                      ? undefined
                                      : (event, item) =>
                                          leftGesture.begin(event, item, {
                                            kind: "move",
                                          })
                                  }
                                  onItemDoubleClick={(item) =>
                                    handleItemDoubleClick("left", item)
                                  }
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
                                        onChange={(text) =>
                                          leftPage.patch(item.id, { text })
                                        }
                                        onDone={handleTextEditDone}
                                      />
                                    ) : (
                                      <SelectionOverlay
                                        resizeHandlers={(corner) =>
                                          leftGesture.handlersFor(item, {
                                            kind: "resize",
                                            corner,
                                          })
                                        }
                                        rotateHandlers={leftGesture.handlersFor(
                                          item,
                                          {
                                            kind: "rotate",
                                          },
                                        )}
                                        resizeLabel={t("edit_resize")}
                                        rotateLabel={t("edit_rotate")}
                                        action={studyActionFor("left", item)}
                                      />
                                    )
                                  }
                                />
                                <NotebookInkLayer
                                  strokes={leftPage.state.doc.ink}
                                  liveStroke={leftInk.liveStroke}
                                  erasing={leftInk.erasing}
                                  onPointerDown={
                                    drawing ? leftInk.begin : undefined
                                  }
                                  onPointerMove={
                                    drawing ? leftInk.move : undefined
                                  }
                                  onPointerUp={
                                    drawing ? leftInk.end : undefined
                                  }
                                />
                              </NotebookPageSurface>
                            </div>

                            {/* One coil across both pages — what actually makes this an open book. */}
                            <NotebookSpine />

                            <div
                              className="h-full"
                              style={{ width: `${PAGE_PERCENT}%` }}
                            >
                              <NotebookPageSurface
                                paper={rightPage.state.doc.paper}
                                coil={false}
                              >
                                <NotebookPageStage
                                  items={rightPage.state.doc.items}
                                  entries={rightMeta?.entries ?? []}
                                  dueIds={dueIds}
                                  selectedId={rightPage.state.selectedId}
                                  contentHiddenId={
                                    editingText?.side === "right"
                                      ? editingText.id
                                      : null
                                  }
                                  onSelect={
                                    drawing
                                      ? undefined
                                      : (id) => handleSelect("right", id)
                                  }
                                  onItemPointerDown={
                                    drawing
                                      ? undefined
                                      : (event, item) =>
                                          rightGesture.begin(event, item, {
                                            kind: "move",
                                          })
                                  }
                                  onItemDoubleClick={(item) =>
                                    handleItemDoubleClick("right", item)
                                  }
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
                                        onChange={(text) =>
                                          rightPage.patch(item.id, { text })
                                        }
                                        onDone={handleTextEditDone}
                                      />
                                    ) : (
                                      <SelectionOverlay
                                        resizeHandlers={(corner) =>
                                          rightGesture.handlersFor(item, {
                                            kind: "resize",
                                            corner,
                                          })
                                        }
                                        rotateHandlers={rightGesture.handlersFor(
                                          item,
                                          {
                                            kind: "rotate",
                                          },
                                        )}
                                        resizeLabel={t("edit_resize")}
                                        rotateLabel={t("edit_rotate")}
                                        action={studyActionFor("right", item)}
                                      />
                                    )
                                  }
                                />
                                <NotebookInkLayer
                                  strokes={rightPage.state.doc.ink}
                                  liveStroke={rightInk.liveStroke}
                                  erasing={rightInk.erasing}
                                  onPointerDown={
                                    drawing ? rightInk.begin : undefined
                                  }
                                  onPointerMove={
                                    drawing ? rightInk.move : undefined
                                  }
                                  onPointerUp={
                                    drawing ? rightInk.end : undefined
                                  }
                                />
                              </NotebookPageSurface>
                            </div>
                          </>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* The leaf itself, flying over both stages. Keyed on `seq` so a second turn
                      restarts it rather than inheriting the first one's half-finished rotation. */}
                    {flip ? (
                      <NotebookPageTurn
                        key={flip.seq}
                        dir={flip.dir}
                        paper={flip.paper}
                        single={flip.single}
                        onDone={() =>
                          setFlip((current) =>
                            current?.seq === flip.seq ? null : current,
                          )
                        }
                      />
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
              {!isMobile ? (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-2 flex w-full items-center justify-center [&>*]:pointer-events-auto"
                  style={{ zIndex: NOTEBOOK_Z.overlay }}
                >
                  {pageNav}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {isMobile ? (
          <div className="flex shrink-0 justify-center">{pageNav}</div>
        ) : null}
      </div>
    </div>
  );
}
