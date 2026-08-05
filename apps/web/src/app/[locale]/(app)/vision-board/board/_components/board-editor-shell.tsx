"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Redo2, Trash2, Type, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VisionBoardDoc, VisionBoardItem, VisionDto } from "@mentor/types";
import { ApiClientError, coachingControllerGetVision, http } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { BoardFrame } from "@/components/vision-board/board-frame";
import { BoardStage } from "@/components/vision-board/board-stage";
import {
  createImageItem,
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
import { BoardContentSkeleton } from "./board-content-skeleton";
import { BoardSelectionOverlay } from "./board-selection-overlay";
import { useBoardReducer } from "./use-board-reducer";
import { useItemGesture } from "./use-item-gesture";
import type { ResizeCorner } from "./board-gesture-math";

/**
 * Collage editor — `/hedef/pano`.
 *
 * The map at `/hedef` stays the data step: it decides what the goal IS. This page only decides
 * what it LOOKS like, which is why it is a separate route rather than a mode of the map, and why
 * it saves through its own endpoint (`PUT /coaching/vision/board`) that never touches the goal
 * columns or the cached premium AI note.
 */

function unwrap<T>(res: unknown): T | null {
  return ((res as { data?: T | null })?.data ?? (res as T | null)) as T | null;
}

/** Blob previews and server URLs both live on `url`; the key is the only thing that is saved. */
type PreviewMap = Record<string, string>;

export function BoardEditorShell() {
  const t = useTranslations("vision.board");
  const common = useTranslations("common");
  const toast = useMentorToast();

  const [vision, setVision] = useState<VisionDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** Object URLs for photos uploaded in this session, revoked on unmount. */
  const [previews, setPreviews] = useState<PreviewMap>({});
  const previewsRef = useRef<PreviewMap>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const { state, dispatch, selected, canUndo, canRedo } = useBoardReducer(
    seededBoard({ goalTitle: "" } as VisionDto, null),
  );

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
            doc: dto.board ?? seededBoard(dto, dto.targetCity),
          });
          // A seeded board is not yet saved state; a loaded one is.
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

  // Object URLs outlive React state unless revoked; a long editing session would otherwise leak
  // every photo the user tried.
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
      setUploading(true);
      try {
        // Sequential on purpose: each upload needs the item list the previous one produced, so
        // fresh photos stagger instead of stacking on the exact same spot.
        for (const file of Array.from(files).slice(0, room)) {
          if (!isSupportedBoardImage(file)) {
            toast.error({ title: t("image_unsupported") });
            continue;
          }
          if (!isWithinBoardImageLimit(file)) {
            toast.error({ title: t("image_too_large") });
            continue;
          }
          const uploaded = await uploadBoardImage(file);
          setPreviews((current) => ({ ...current, [uploaded.key]: uploaded.url }));
          dispatch({
            type: "add",
            item: createImageItem(
              crypto.randomUUID(),
              uploaded.key,
              state.doc.items,
              uploaded.aspectRatio,
            ),
          });
        }
      } catch {
        toast.error({ title: t("image_upload_failed") });
      } finally {
        setUploading(false);
      }
    },
    [dispatch, state.doc.items, t, toast],
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await http("/v1/coaching/vision/board", {
        method: "PUT",
        body: JSON.stringify({ board: state.doc }),
      });
      dispatch({ type: "saved" });
      toast.success({ title: t("saved") });
    } catch (error) {
      // The backend localizes its own messages; show them rather than inventing copy here.
      const message =
        error instanceof ApiClientError ? error.message : common("error_generic");
      toast.error({ title: message });
    } finally {
      setSaving(false);
    }
  }, [common, dispatch, state.doc, t, toast]);

  // Ctrl/Cmd+Z is the reflex in any canvas editor; without it a mis-drag feels unrecoverable.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
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
  }, [dispatch, state.selectedId]);

  if (!loaded) return <BoardContentSkeleton />;
  if (loadError) return <FormError message={loadError} />;

  // No goal, nothing for a board to be about — send them to the map rather than inventing one.
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

  /** Photos uploaded this session render from their blob URL until the next server read. */
  const docForRender: VisionBoardDoc = {
    ...state.doc,
    items: state.doc.items.map((item) =>
      item.kind === "image" && previews[item.storageKey]
        ? { ...item, url: previews[item.storageKey] }
        : item,
    ),
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="flex gap-2 lg:w-44 lg:flex-col">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) void addImages(event.target.files);
            // Reset so picking the same file twice still fires a change event.
            event.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          fullWidth
          busy={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus aria-hidden size={18} />
          {t("add_image")}
        </Button>
        <Button variant="secondary" fullWidth onClick={addText}>
          <Type aria-hidden size={18} />
          {t("add_text")}
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/vision-board"
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold"
            style={{ color: "var(--color-secondary)" }}
          >
            <ArrowLeft aria-hidden size={16} />
            {t("back")}
          </Link>

          <div className="flex items-center gap-1">
            <IconButton
              label={t("undo")}
              disabled={!canUndo}
              onClick={() => dispatch({ type: "undo" })}
            >
              <Undo2 aria-hidden size={18} />
            </IconButton>
            <IconButton
              label={t("redo")}
              disabled={!canRedo}
              onClick={() => dispatch({ type: "redo" })}
            >
              <Redo2 aria-hidden size={18} />
            </IconButton>
            <IconButton
              label={t("delete")}
              disabled={!selected}
              onClick={() =>
                selected ? dispatch({ type: "remove", id: selected.id }) : undefined
              }
            >
              <Trash2 aria-hidden size={18} />
            </IconButton>
          </div>

          <div className="ms-auto flex items-center gap-2">
            {state.dirty ? (
              <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
                {t("unsaved")}
              </span>
            ) : null}
            <Button busy={saving} onClick={() => void save()}>
              {t("save")}
            </Button>
          </div>
        </div>

        {selected?.kind === "text" ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
              {t("text_content")}
            </span>
            <textarea
              value={selected.text}
              maxLength={280}
              rows={2}
              onFocus={checkpoint}
              onChange={(event) =>
                dispatch({
                  type: "patch",
                  id: selected.id,
                  // Typing is transient for the same reason dragging is: one history entry per
                  // edit session, not one per keystroke. `onFocus` took the snapshot.
                  patch: { text: event.target.value, source: undefined },
                  transient: true,
                })
              }
              className="w-full rounded-[var(--radius-card)] border p-2 text-sm"
              style={{
                borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
                color: "var(--color-body)",
              }}
            />
          </label>
        ) : null}

        <BoardFrame frame={state.doc.frame}>
          <div data-board-stage>
            <BoardStage
              doc={docForRender}
              selectedId={state.selectedId}
              onSelect={(id) => dispatch({ type: "select", id })}
              onItemPointerDown={(event, item) => gesture.begin(event, item, { kind: "move" })}
              renderOverlay={(item) => (
                <BoardSelectionOverlay
                  item={item}
                  resizeLabel={t("resize")}
                  rotateLabel={t("rotate")}
                  resizeHandlers={(corner: ResizeCorner) =>
                    gesture.handlersFor(item, { kind: "resize", corner })
                  }
                  rotateHandlers={gesture.handlersFor(item, { kind: "rotate" })}
                />
              )}
            />
          </div>
        </BoardFrame>
      </div>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors hover:bg-white/70 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{ color: "var(--color-main)" }}
    >
      {children}
    </button>
  );
}
