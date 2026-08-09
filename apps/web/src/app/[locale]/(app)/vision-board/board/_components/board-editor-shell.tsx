"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  Download,
  ImagePlus,
  LayoutTemplate,
  LoaderCircle,
  PanelTop,
  Redo2,
  Share2,
  Smile,
  Type,
  Undo2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  VISION_STICKERS,
  type VisionBoardDoc,
  type VisionBoardItem,
  type VisionDto,
} from "@mentor/types";
import { ApiClientError, coachingControllerGetVision, http } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { BoardFrame } from "@/components/vision-board/board-frame";
import { BoardStage } from "@/components/vision-board/board-stage";
import {
  BoardExportTaintedError,
  renderBoardToBlob,
  shareOrDownloadBoard,
  downloadBlob,
} from "@/components/vision-board/board-export";
import {
  createImageItem,
  createStickerItem,
  createTextItem,
  seededBoard,
} from "@/components/vision-board/board-document";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  isSupportedBoardImage,
  isWithinBoardImageLimit,
  uploadBoardImage,
} from "@/lib/vision-board-images";
import { VISION_BOARD_MAX_IMAGES, VISION_BOARD_MAX_TEXTS } from "@mentor/validation";
import { boardChromeFastTransition, boardChromeTransition } from "./board-chrome-motion";
import { BoardColorPanel } from "./board-color-panel";
import { BoardContentSkeleton } from "./board-content-skeleton";
import { BoardContextToolbar } from "./board-context-toolbar";
import type { ColorPanelTarget } from "./board-palettes";
import { BoardSelectionOverlay } from "./board-selection-overlay";
import { BoardSidePanel, type BoardPanelCategory } from "./board-side-panel";
import { BoardTextInlineEditor } from "./board-text-inline-editor";
import { applyTemplate } from "./board-templates";
import { useBoardReducer } from "./use-board-reducer";
import { useItemGesture } from "./use-item-gesture";
import type { ResizeCorner } from "./board-gesture-math";

/**
 * Collage editor — `/hedef/pano`.
 *
 * Canva-style chrome: icon category rail + collapsible detail panel + selection contextual
 * toolbar. The map at `/hedef` decides what the goal IS; this page only decides what it LOOKS
 * like (`PUT /coaching/vision/board`).
 */

function unwrap<T>(res: unknown): T | null {
  return ((res as { data?: T | null })?.data ?? (res as T | null)) as T | null;
}

type PreviewMap = Record<string, string>;

const CATEGORIES: {
  id: BoardPanelCategory;
  icon: typeof ImagePlus;
  labelKey: "nav_image" | "nav_text" | "nav_sticker" | "nav_template" | "nav_board";
}[] = [
  { id: "image", icon: ImagePlus, labelKey: "nav_image" },
  { id: "text", icon: Type, labelKey: "nav_text" },
  { id: "sticker", icon: Smile, labelKey: "nav_sticker" },
  { id: "template", icon: LayoutTemplate, labelKey: "nav_template" },
  { id: "board", icon: PanelTop, labelKey: "nav_board" },
];

function subtitleFor(dto: VisionDto): string | null {
  const { universityName, titleName, institutionName, cityName } = dto.targetNames;
  const primary = universityName ?? titleName ?? institutionName;
  if (primary && cityName) return `${primary} · ${cityName}`;
  return primary ?? cityName;
}

function nextZ(items: readonly VisionBoardItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.z), 0) + 1;
}

export function BoardEditorShell() {
  const t = useTranslations("vision.board");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const reduceMotion = useReducedMotion();

  const [vision, setVision] = useState<VisionDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const [activePanel, setActivePanel] = useState<BoardPanelCategory | null>("board");
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [colorTarget, setColorTarget] = useState<ColorPanelTarget | null>(null);
  const [previews, setPreviews] = useState<PreviewMap>({});
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [rawEditingTextId, setEditingTextId] = useState<string | null>(null);
  const previewsRef = useRef<PreviewMap>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const { state, dispatch, selected, patchSelected, canUndo, canRedo } = useBoardReducer(
    seededBoard({ goalTitle: "" } as VisionDto, null),
  );

  const detailOpen = activePanel != null && !detailCollapsed;
  const showColorPanel = colorTarget != null;

  useEffect(() => {
    let active = true;
    coachingControllerGetVision()
      .then((res) => {
        if (!active) return;
        const dto = unwrap<VisionDto>(res);
        setVision(dto);
        if (dto) {
          dispatch({
            type: "replace",
            doc: dto.board ?? seededBoard(dto, subtitleFor(dto)),
          });
          dispatch({ type: "saved" });
          if (!dto.board) dispatch({ type: "checkpoint" });
        }
      })
      .catch(() => {
        if (active) setLoadError(common("error_generic"));
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [common, dispatch]);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);
  useEffect(
    () => () => {
      for (const url of Object.values(previewsRef.current)) URL.revokeObjectURL(url);
    },
    [],
  );

  const patch = useCallback(
    (id: string, next: Partial<VisionBoardItem>) =>
      dispatch({ type: "patch", id, patch: next, transient: true }),
    [dispatch],
  );
  const checkpoint = useCallback(() => dispatch({ type: "checkpoint" }), [dispatch]);
  const gesture = useItemGesture({
    patch,
    checkpoint,
    lockRatioFor: (item) => item.kind === "image",
  });

  const handleSelect = useCallback(
    (id: string | null) => {
      setEditingTextId((current) => (current && current !== id ? null : current));
      const item = id ? state.doc.items.find((candidate) => candidate.id === id) : null;
      if (item) {
        setColorTarget(null);
        setActivePanel(item.kind === "text" ? "text" : item.kind === "image" ? "image" : "sticker");
        setDetailCollapsed(false);
      }
      dispatch({ type: "select", id });
    },
    [dispatch, state.doc.items],
  );
  const handleItemPointerDown = useCallback(
    (event: React.PointerEvent, item: VisionBoardItem) =>
      gesture.begin(event, item, { kind: "move" }),
    [gesture],
  );
  const handleItemDoubleClick = useCallback(
    (item: VisionBoardItem) => {
      if (item.kind !== "text") return;
      checkpoint();
      setEditingTextId(item.id);
    },
    [checkpoint],
  );

  // Derived, not stored: a deleted or undone-away item can't stay "being edited", and deriving it
  // means there is nothing to resync in an effect when the item list changes underneath it.
  const editingTextId =
    rawEditingTextId && state.doc.items.some((item) => item.id === rawEditingTextId)
      ? rawEditingTextId
      : null;

  const selectedId = state.selectedId;
  const handleLayer = useCallback(
    (direction: "front" | "back") =>
      selectedId
        ? dispatch({
            type: direction === "front" ? "bringToFront" : "sendToBack",
            id: selectedId,
          })
        : undefined,
    [dispatch, selectedId],
  );
  const removeSelected = useCallback(
    () => (selectedId ? dispatch({ type: "remove", id: selectedId }) : undefined),
    [dispatch, selectedId],
  );

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const clone: VisionBoardItem = {
      ...selected,
      id: crypto.randomUUID(),
      x: selected.x + 40,
      y: selected.y + 40,
      z: nextZ(state.doc.items),
    };
    dispatch({ type: "add", item: clone });
  }, [dispatch, selected, state.doc.items]);

  const openCategory = useCallback((id: BoardPanelCategory) => {
    setColorTarget(null);
    setActivePanel((current) => {
      if (current === id) {
        setDetailCollapsed((collapsed) => !collapsed);
        return id;
      }
      setDetailCollapsed(false);
      return id;
    });
  }, []);

  const openColor = useCallback((target: ColorPanelTarget) => {
    setColorTarget(target);
    setDetailCollapsed(false);
    setActivePanel("text");
  }, []);

  const addText = useCallback(() => {
    if (state.doc.items.filter((i) => i.kind === "text").length >= VISION_BOARD_MAX_TEXTS) {
      toast.error({ title: t("limit_texts") });
      return;
    }
    dispatch({
      type: "add",
      item: createTextItem(crypto.randomUUID(), t("new_text"), state.doc.items),
    });
  }, [dispatch, state.doc.items, t, toast]);

  const addImages = useCallback(
    async (files: FileList) => {
      const room =
        VISION_BOARD_MAX_IMAGES - state.doc.items.filter((i) => i.kind === "image").length;
      if (room <= 0) {
        toast.error({ title: t("limit_images") });
        return;
      }
      const queued = Array.from(files).slice(0, room);
      setUploadProgress({ done: 0, total: queued.length });
      try {
        for (const [index, file] of queued.entries()) {
          if (!isSupportedBoardImage(file)) {
            toast.error({ title: t("image_unsupported") });
            setUploadProgress({ done: index + 1, total: queued.length });
            continue;
          }
          if (!isWithinBoardImageLimit(file)) {
            toast.error({ title: t("image_too_large") });
            setUploadProgress({ done: index + 1, total: queued.length });
            continue;
          }
          const uploaded = await uploadBoardImage(file);
          // Tracked separately from the item for revocation only — see the unmount cleanup below.
          setPreviews((current) => ({ ...current, [uploaded.key]: uploaded.url }));
          dispatch({
            type: "add",
            // `url` set directly on the item at creation, not merged in at render time. A
            // separate `previews[storageKey]` overlay computed fresh every render was a second
            // source of truth for the same value — harmless in theory, but "does this key exist
            // in that other map on this render" is exactly the kind of thing that goes stale
            // silently. The item now carries its own url from the moment it exists.
            item: {
              ...createImageItem(
                crypto.randomUUID(),
                uploaded.key,
                state.doc.items,
                uploaded.aspectRatio,
              ),
              url: uploaded.url,
            },
          });
          setUploadProgress({ done: index + 1, total: queued.length });
        }
      } catch {
        toast.error({ title: t("image_upload_failed") });
      } finally {
        setUploadProgress(null);
      }
    },
    [dispatch, state.doc.items, t, toast],
  );

  const addSticker = useCallback(
    (asset: (typeof VISION_STICKERS)[number]) => {
      dispatch({
        type: "add",
        item: createStickerItem(crypto.randomUUID(), asset, state.doc.items),
      });
    },
    [dispatch, state.doc.items],
  );

  const save = useCallback(
    async (doc: VisionBoardDoc = state.doc) => {
      setSaving(true);
      try {
        await http("/v1/coaching/vision/board", {
          method: "PUT",
          body: JSON.stringify({ board: doc }),
        });
        dispatch({ type: "saved" });
        return true;
      } catch (error) {
        const message =
          error instanceof ApiClientError ? error.message : common("error_generic");
        toast.error({ title: message });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [common, dispatch, state.doc, toast],
  );

  const publish = useCallback(async () => {
    const doc: VisionBoardDoc = { ...state.doc, status: "PUBLISHED" };
    dispatch({ type: "setStatus", status: "PUBLISHED" });
    if (await save(doc)) toast.success({ title: t("published") });
  }, [dispatch, save, state.doc, t, toast]);

  const exportBoard = useCallback(
    async (mode: "download" | "share", doc: VisionBoardDoc) => {
      setExporting(true);
      try {
        const blob = await renderBoardToBlob(doc);
        const fileName = `${t("file_name")}.png`;
        if (mode === "download") downloadBlob(blob, fileName);
        else await shareOrDownloadBoard(blob, fileName);
      } catch (error) {
        toast.error({
          title:
            error instanceof BoardExportTaintedError
              ? t("export_blocked")
              : t("export_failed"),
        });
      } finally {
        setExporting(false);
      }
    },
    [t, toast],
  );

  /*
   * Autosave: a paused edit (2s of silence) writes the draft to the server that the manual
   * "Kaydet" button already writes to — same endpoint, same DRAFT/PUBLISHED status, so a refresh
   * or a closed tab never loses more than the last couple of seconds of work. Deliberately silent
   * (no toast, no spinner): the existing "Kaydedilmedi" label already reflects `dirty`, and it
   * clears itself the moment this fires — that's feedback enough for something that "just works".
   */
  useEffect(() => {
    if (!state.dirty) return;
    const timer = setTimeout(() => {
      void http("/v1/coaching/vision/board", {
        method: "PUT",
        body: JSON.stringify({ board: state.doc }),
      })
        .then(() => dispatch({ type: "saved" }))
        .catch(() => {
          /* Silent by design — the manual Save button and its error toast are the fallback. */
        });
    }, 2000);
    return () => clearTimeout(timer);
  }, [dispatch, state.dirty, state.doc]);

  // Refs so the listeners below (registered once) always PUT the latest document, not the one
  // from whichever render first attached them.
  const latestDocRef = useRef(state.doc);
  const latestDirtyRef = useRef(state.dirty);
  useEffect(() => {
    latestDocRef.current = state.doc;
    latestDirtyRef.current = state.dirty;
  }, [state.doc, state.dirty]);

  useEffect(() => {
    function flush() {
      if (!latestDirtyRef.current) return;
      // `keepalive` lets the request outlive the page — the normal path for a tab actually
      // closing, where an ordinary fetch would be aborted mid-flight.
      void http("/v1/coaching/vision/board", {
        method: "PUT",
        body: JSON.stringify({ board: latestDocRef.current }),
        keepalive: true,
      })
        .then(() => dispatch({ type: "saved" }))
        .catch(() => {});
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, [dispatch]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const targetEl = event.target as HTMLElement | null;
      if (targetEl?.closest("input, textarea, [contenteditable='true']")) return;
      if (event.key === "Escape") {
        if (colorTarget) {
          event.preventDefault();
          setColorTarget(null);
          return;
        }
        if (detailOpen) {
          event.preventDefault();
          setDetailCollapsed(true);
          return;
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && state.selectedId) {
        event.preventDefault();
        dispatch({ type: "remove", id: state.selectedId });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [colorTarget, detailOpen, dispatch, state.selectedId]);

  if (!loaded) return <BoardContentSkeleton />;
  if (loadError) return <FormError message={loadError} />;

  if (!vision) {
    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("no_goal_title")}
        </h1>
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("no_goal_body")}
        </p>
        <Link href="/vision-board">
          <Button>{t("no_goal_cta")}</Button>
        </Link>
      </section>
    );
  }

  // Every image item already carries its own `url` — set at upload time locally, set by the
  // server (`enrich()`) on every load. Nothing left to merge in at render time.
  const docForRender: VisionBoardDoc = state.doc;

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => {
          if (event.target.files?.length) void addImages(event.target.files);
          event.target.value = "";
        }}
      />

      <nav
        aria-label={t("editor_nav")}
        className="mentor-scrollarea flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-2 lg:w-16 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:border-b-0 lg:border-e lg:px-1 lg:pb-3 lg:pt-8"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "rgba(17, 17, 17, 0.08)",
        }}
      >
        <Link
          href="/vision-board"
          aria-label={t("back")}
          title={t("back")}
          className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            backgroundColor: "var(--color-surface)",
            boxShadow: "var(--shadow-card)",
            color: "var(--color-main)",
          }}
        >
          <ArrowLeft aria-hidden size={18} />
        </Link>

        {CATEGORIES.map(({ id, icon: Icon, labelKey }) => {
          const active = activePanel === id && !detailCollapsed;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              aria-expanded={activePanel === id && detailOpen}
              onClick={() => openCategory(id)}
              className="relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-card)] px-1 py-1.5 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] lg:min-w-0 lg:w-full"
              style={{
                color: active ? "#ffffff" : "var(--color-secondary)",
              }}
            >
              {active ? (
                reduceMotion ? (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-[var(--radius-card)]"
                    style={{ backgroundColor: "var(--color-main)" }}
                  />
                ) : (
                  <motion.span
                    layoutId="board-editor-nav-active"
                    aria-hidden
                    className="absolute inset-0 rounded-[var(--radius-card)]"
                    style={{ backgroundColor: "var(--color-main)" }}
                    transition={boardChromeTransition}
                  />
                )
              ) : null}
              <Icon aria-hidden size={20} className="relative z-[1]" />
              <span className="relative z-[1] leading-tight">{t(labelKey)}</span>
            </button>
          );
        })}
      </nav>

      <AnimatePresence initial={false}>
        {detailOpen || showColorPanel ? (
          <motion.aside
            key="board-detail-panel"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
            transition={boardChromeTransition}
            className="relative flex min-h-0 max-h-[40vh] w-full shrink-0 flex-col border-b lg:max-h-none lg:w-64 lg:border-b-0 lg:border-e"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "rgba(17, 17, 17, 0.08)",
            }}
          >
            <button
              type="button"
              aria-label={t("collapse_panel")}
              onClick={() => {
                if (showColorPanel) setColorTarget(null);
                else setDetailCollapsed(true);
              }}
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
                  key={
                    showColorPanel && colorTarget
                      ? `color-${colorTarget}`
                      : `panel-${activePanel}`
                  }
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={boardChromeFastTransition}
                  className="h-full"
                >
                  {showColorPanel && colorTarget ? (
                    <BoardColorPanel
                      target={colorTarget}
                      selected={selected}
                      onPatch={(next) => patchSelected(next)}
                      onClose={() => setColorTarget(null)}
                    />
                  ) : activePanel ? (
                    <BoardSidePanel
                      category={activePanel}
                      doc={state.doc}
                      selected={selected}
                      selectedId={state.selectedId}
                      uploadProgress={uploadProgress}
                      onAddText={addText}
                      onUploadImage={() => fileInput.current?.click()}
                      onAddSticker={addSticker}
                      onSelectItem={handleSelect}
                      onApplyTemplate={(id) =>
                        dispatch({ type: "replace", doc: applyTemplate(state.doc, id) })
                      }
                      onPatch={patchSelected}
                      onCheckpoint={checkpoint}
                      onSetFrame={(frame) => dispatch({ type: "setFrame", frame })}
                      onSetBackground={(background) =>
                        dispatch({ type: "setBackground", background })
                      }
                    />
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2 lg:p-3">
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            label={t("undo")}
            disabled={!canUndo}
            onClick={() => dispatch({ type: "undo" })}
          >
            <Undo2 aria-hidden size={17} />
          </IconButton>
          <IconButton
            label={t("redo")}
            disabled={!canRedo}
            onClick={() => dispatch({ type: "redo" })}
          >
            <Redo2 aria-hidden size={17} />
          </IconButton>

          <div className="ms-auto flex items-center gap-0.5">
            {state.dirty ? (
              <span className="me-1 text-xs" style={{ color: "var(--color-secondary)" }}>
                {t("unsaved")}
              </span>
            ) : null}
            <IconButton
              label={t("download")}
              disabled={exporting}
              busy={exporting}
              onClick={() => void exportBoard("download", docForRender)}
            >
              <Download aria-hidden size={17} />
            </IconButton>
            <IconButton
              label={t("share")}
              disabled={exporting}
              busy={exporting}
              onClick={() => void exportBoard("share", docForRender)}
            >
              <Share2 aria-hidden size={17} />
            </IconButton>
            <button
              type="button"
              disabled={saving}
              aria-busy={saving || undefined}
              onClick={() => void save().then((ok) => ok && toast.success({ title: t("saved") }))}
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ color: "var(--color-main)" }}
            >
              {saving ? (
                <LoaderCircle
                  aria-hidden
                  size={15}
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t("save")}
            </button>
            {state.doc.status === "PUBLISHED" ? null : (
              <button
                type="button"
                disabled={saving}
                aria-busy={saving || undefined}
                onClick={() => void publish()}
                className="inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ backgroundColor: "var(--color-btn)" }}
              >
                {saving ? (
                  <LoaderCircle
                    aria-hidden
                    size={15}
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : null}
                {t("publish")}
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-[52px] shrink-0 items-center justify-center">
          <AnimatePresence initial={false}>
            {selected ? (
              <BoardContextToolbar
                key="context-toolbar"
                selected={selected}
                onPatch={patchSelected}
                onCheckpoint={checkpoint}
                onLayer={handleLayer}
                onDuplicate={duplicateSelected}
                onRemove={removeSelected}
                onOpenColor={openColor}
                onOpenImageFrames={() => {
                  setColorTarget(null);
                  setActivePanel("image");
                  setDetailCollapsed(false);
                }}
              />
            ) : null}
          </AnimatePresence>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setIsDraggingOver(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setIsDraggingOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDraggingOver(false);
            if (event.dataTransfer.files.length) void addImages(event.dataTransfer.files);
          }}
        >
          {isDraggingOver ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[var(--radius-card)]"
              style={{
                border: "2px dashed var(--color-accent)",
                backgroundColor: "var(--color-progress-track)",
                opacity: 0.85,
              }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
                {t("drop_hint")}
              </span>
            </div>
          ) : null}
          <div className="w-full max-w-full">
            <BoardFrame
              frame={state.doc.frame}
              style={{
                maxWidth: "calc((100dvh - 12rem) * 1.5)",
                margin: "0 auto",
              }}
            >
              <BoardStage
                doc={docForRender}
                selectedId={state.selectedId}
                contentHiddenId={editingTextId}
                onSelect={handleSelect}
                onItemPointerDown={handleItemPointerDown}
                onItemDoubleClick={handleItemDoubleClick}
                onPointerMove={gesture.move}
                onPointerUp={gesture.end}
                renderOverlay={(item) =>
                  item.kind === "text" && item.id === editingTextId ? (
                    <BoardTextInlineEditor
                      item={item}
                      label={t("text_content")}
                      onChange={(text) => patch(item.id, { text, source: undefined })}
                      onDone={() => setEditingTextId(null)}
                    />
                  ) : (
                    <BoardSelectionOverlay
                      item={item}
                      resizeLabel={t("resize")}
                      rotateLabel={t("rotate")}
                      resizeHandlers={(corner: ResizeCorner) =>
                        gesture.handlersFor(item, { kind: "resize", corner })
                      }
                      rotateHandlers={gesture.handlersFor(item, { kind: "rotate" })}
                    />
                  )
                }
              />
            </BoardFrame>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  busy,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy || undefined}
      title={label}
      disabled={disabled || busy}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-container)] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{ color: "var(--color-main)" }}
    >
      {busy ? (
        <LoaderCircle aria-hidden size={17} className="animate-spin motion-reduce:animate-none" />
      ) : (
        children
      )}
    </button>
  );
}
