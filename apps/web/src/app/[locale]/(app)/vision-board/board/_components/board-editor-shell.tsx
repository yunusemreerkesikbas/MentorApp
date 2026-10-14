"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import {
  VISION_BOARD_CANVAS,
  VISION_STICKERS,
  type VisionBoardItem,
  type VisionDto,
} from "@mentor/types";
import { VISION_BOARD_MAX_TEXTS } from "@mentor/validation";
import { Button } from "@mentor/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { useItemGesture } from "@/components/stage/use-item-gesture";
import {
  createStickerItem,
  createTextItem,
  seededBoard,
} from "@/components/vision-board/board-document";
import { useMentorToast } from "@/lib/mentor-toast";
import { BoardColorPanel } from "./board-color-panel";
import { BoardContentSkeleton } from "./board-content-skeleton";
import { BoardContextToolbar } from "./board-context-toolbar";
import { BoardEditorPanel } from "./board-editor-panel";
import { BOARD_CATEGORY_LABEL_KEYS, BoardEditorRail } from "./board-editor-rail";
import { BoardEditorStage } from "./board-editor-stage";
import { BoardEditorTopbar } from "./board-editor-topbar";
import type { ColorPanelTarget } from "./board-palettes";
import { BoardSidePanel, type BoardPanelCategory } from "./board-side-panel";
import { applyTemplate } from "./board-templates";
import { useBoardImages } from "./use-board-images";
import { useBoardPersistence } from "./use-board-persistence";
import { useBoardReducer } from "./use-board-reducer";
import { useBoardShortcuts } from "./use-board-shortcuts";

/**
 * Collage editor — `/hedef/pano`.
 *
 * The notebook's chrome around a framed board on a wall (DESIGN.md §11): a stadium rail of
 * categories, a titled panel beside it and a contextual toolbar over the selection. From `lg` the
 * rail and the panel float at the board's left and the board steps aside for the panel; below,
 * the rail is a dock under the board and the panel a sheet behind it. The map at `/hedef` decides
 * what the goal IS; this page only decides what it LOOKS like.
 *
 * This file orchestrates. The document's trips to the server, the photo queue and the keyboard
 * live in their own hooks; the rail, the panel and the top bar render themselves.
 */

/** The share window draws the board onto a canvas: loaded only when it is opened. */
const BoardShareSheet = dynamic(
  () => import("./board-share-sheet").then((module) => ({ default: module.BoardShareSheet })),
  { ssr: false },
);

/** Tailwind's `lg`, read in JS for what CSS cannot decide: whether the panel starts open. */
const WIDE_QUERY = "(min-width: 1024px)";
const isWide = () => window.matchMedia(WIDE_QUERY).matches;

function nextZ(items: readonly VisionBoardItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.z), 0) + 1;
}

export function BoardEditorShell() {
  const t = useTranslations("vision.board");
  const toast = useMentorToast();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [shareOpen, setShareOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<BoardPanelCategory>("board");
  /*
   * A phone's panel is a sheet over the lower half of the screen, so there the board is shown
   * first and the sheet waits for a tap on the dock. Read once: the skeleton is what renders on
   * the server and on the first client pass, so this value never reaches hydrated markup.
   */
  const [detailCollapsed, setDetailCollapsed] = useState(
    () => typeof window !== "undefined" && !isWide(),
  );
  const [colorTarget, setColorTarget] = useState<ColorPanelTarget | null>(null);
  const [rawEditingTextId, setEditingTextId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { state, dispatch, selected, patchSelected, canUndo, canRedo } = useBoardReducer(
    seededBoard({ goalTitle: "" } as VisionDto, null),
  );
  const { vision, loaded, loadError, saving, saveNow, publish } = useBoardPersistence(
    state,
    dispatch,
  );
  const { uploadProgress, addImages } = useBoardImages(state.doc.items, dispatch);

  const showColorPanel = colorTarget != null;
  const panelOpen = !detailCollapsed || showColorPanel;

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
    canvasWidth: VISION_BOARD_CANVAS.width,
  });

  const openPanel = useCallback((id: BoardPanelCategory) => {
    setColorTarget(null);
    setActivePanel(id);
    setDetailCollapsed(false);
  }, []);

  const handleSelect = useCallback(
    (id: string | null) => {
      setEditingTextId((current) => (current && current !== id ? null : current));
      const item = id ? state.doc.items.find((candidate) => candidate.id === id) : null;
      if (item) {
        setColorTarget(null);
        setActivePanel(item.kind === "text" ? "text" : item.kind === "image" ? "image" : "sticker");
        // Beside the board the item's controls open with it. A phone only lines the category up:
        // a sheet that rose on every tap would cover the board someone is trying to arrange.
        if (isWide()) setDetailCollapsed(false);
      }
      dispatch({ type: "select", id });
    },
    [dispatch, state.doc.items],
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

  /*
   * Tap a category: switch to it and open the panel, or shut the panel if it was already showing.
   * The two setters are siblings on purpose. Nesting the toggle inside `setActivePanel`'s updater
   * made it an impure updater, which Strict Mode runs twice, and a toggle run twice is no toggle
   * (the notebook's rail had the same bug).
   */
  const openCategory = useCallback(
    (id: BoardPanelCategory) => {
      setColorTarget(null);
      if (activePanel === id) {
        setDetailCollapsed((collapsed) => !collapsed);
      } else {
        setActivePanel(id);
        setDetailCollapsed(false);
      }
    },
    [activePanel],
  );

  const openColor = useCallback((target: ColorPanelTarget) => {
    setColorTarget(target);
    setDetailCollapsed(false);
    setActivePanel("text");
  }, []);

  const addText = useCallback(() => {
    if (state.doc.items.filter((i) => i.kind === "text").length >= VISION_BOARD_MAX_TEXTS) {
      toast.warning({ title: t("limit_texts") });
      return;
    }
    dispatch({
      type: "add",
      item: createTextItem(crypto.randomUUID(), t("new_text"), state.doc.items),
    });
  }, [dispatch, state.doc.items, t, toast]);

  const addSticker = useCallback(
    (asset: (typeof VISION_STICKERS)[number]) => {
      dispatch({
        type: "add",
        item: createStickerItem(crypto.randomUUID(), asset, state.doc.items),
      });
    },
    [dispatch, state.doc.items],
  );

  const handleEscape = useCallback(() => {
    if (colorTarget) {
      setColorTarget(null);
      return true;
    }
    if (!detailCollapsed) {
      setDetailCollapsed(true);
      return true;
    }
    return false;
  }, [colorTarget, detailCollapsed]);
  useBoardShortcuts({ selected, dispatch, onEscape: handleEscape });

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

  // Still the board the goal seeded, or one emptied again: nothing added, nothing rewritten.
  // Read off the document, so the welcome needs no state and never comes back once it has gone.
  const untouched = state.doc.items.every(
    (item) => item.kind === "text" && item.source === "goal",
  );

  return (
    /*
     * The wall the board hangs on. A chrome surface, so it follows the theme; the board's own
     * canvas does not (DESIGN.md §2.5).
     */
    <div
      className="relative isolate flex h-dvh flex-col overflow-hidden"
      style={{ backgroundColor: "var(--color-surface-container)" }}
    >
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

      <BoardEditorTopbar
        canUndo={canUndo}
        canRedo={canRedo}
        dirty={state.dirty}
        saving={saving}
        published={state.doc.status === "PUBLISHED"}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onShare={() => setShareOpen(true)}
        onSave={() => void saveNow()}
        onPublish={() => void publish()}
      />

      {/*
        From `lg` the board steps aside for the open panel rather than being covered by it: a
        frame or a background is chosen against the whole board. 5.5rem clears the rail, 26.5rem
        the rail and the panel. On a wide window the board is height-bound and does not shrink.
      */}
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-2 pb-2 max-lg:pt-2 lg:pb-3 lg:pe-4 ${panelOpen ? "lg:ps-[26.5rem]" : "lg:ps-[5.5rem]"}`}
      >
        {/*
          The selection's toolbar keeps a row of its own so the board never jumps when something
          is picked. From `lg` that row is above the board; on a phone it is under it, over the
          dock, which leaves the board at the top of the screen and clear of the sheet.
        */}
        <div className="flex min-h-[52px] shrink-0 items-center justify-center max-lg:order-last">
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
                onOpenImageFrames={() => openPanel("image")}
              />
            ) : null}
          </AnimatePresence>
        </div>

        <BoardEditorStage
          doc={state.doc}
          selectedId={state.selectedId}
          editingTextId={editingTextId}
          untouched={untouched}
          gesture={gesture}
          onSelect={handleSelect}
          onItemDoubleClick={handleItemDoubleClick}
          // Rewriting the seeded line makes it the user's own: the goal marker comes off.
          onTextChange={(id, text) => patch(id, { text, source: undefined })}
          onTextDone={() => setEditingTextId(null)}
          onDropFiles={(files) => void addImages(files)}
          onAddImage={() => fileInput.current?.click()}
          onOpenTemplates={() => openPanel("template")}
        />
      </div>

      <BoardEditorPanel
        open={panelOpen}
        title={showColorPanel ? t("color_panel_title") : t(BOARD_CATEGORY_LABEL_KEYS[activePanel])}
        bodyKey={colorTarget ? `color-${colorTarget}` : `panel-${activePanel}`}
        reduceMotion={reduceMotion}
        onCollapse={() => {
          if (showColorPanel) setColorTarget(null);
          else setDetailCollapsed(true);
        }}
      >
        {colorTarget ? (
          <BoardColorPanel target={colorTarget} selected={selected} onPatch={patchSelected} />
        ) : (
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
            onSetBackground={(background) => dispatch({ type: "setBackground", background })}
          />
        )}
      </BoardEditorPanel>

      <BoardEditorRail
        active={detailCollapsed ? null : activePanel}
        sheetOpen={panelOpen}
        reduceMotion={reduceMotion}
        onOpen={openCategory}
      />

      {shareOpen ? (
        <BoardShareSheet
          doc={state.doc}
          onClose={() => setShareOpen(false)}
          onShared={(thread) => {
            // Said from here, once the window is gone: a toast sits under a dialog's top layer.
            setShareOpen(false);
            toast.success({
              title: t("community_shared"),
              action: {
                label: t("community_shared_view"),
                onClick: () =>
                  router.push({
                    pathname: "/community/message/[threadId]",
                    params: { threadId: thread.id },
                  }),
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
