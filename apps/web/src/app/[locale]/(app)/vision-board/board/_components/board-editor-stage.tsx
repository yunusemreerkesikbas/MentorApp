"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import type { VisionBoardDoc, VisionBoardItem } from "@mentor/types";
import type { ResizeCorner } from "@/components/stage/gesture-math";
import { SelectionOverlay } from "@/components/stage/selection-overlay";
import type { useItemGesture } from "@/components/stage/use-item-gesture";
import { BoardFrame } from "@/components/vision-board/board-frame";
import { BoardStage } from "@/components/vision-board/board-stage";
import { BoardTextInlineEditor } from "./board-text-inline-editor";
import { BoardWelcome } from "./board-welcome";

export interface BoardEditorStageProps {
  doc: VisionBoardDoc;
  selectedId: string | null;
  /** The text item being typed into in place, if any. */
  editingTextId: string | null;
  /** Nobody has touched the board yet: Puhu's welcome shows under it. */
  untouched: boolean;
  gesture: ReturnType<typeof useItemGesture<VisionBoardItem>>;
  onSelect: (id: string | null) => void;
  onItemDoubleClick: (item: VisionBoardItem) => void;
  onTextChange: (id: string, text: string) => void;
  onTextDone: () => void;
  onDropFiles: (files: FileList) => void;
  onAddImage: () => void;
  onOpenTemplates: () => void;
}

/**
 * The framed board on its wall: where photos are dropped, and where the selected item wears its
 * handles or its in-place text box.
 */
export function BoardEditorStage({
  doc,
  selectedId,
  editingTextId,
  untouched,
  gesture,
  onSelect,
  onItemDoubleClick,
  onTextChange,
  onTextDone,
  onDropFiles,
  onAddImage,
  onOpenTemplates,
}: BoardEditorStageProps) {
  const t = useTranslations("vision.board");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Stable, or `BoardStage`'s memoised items re-render on every pointer move.
  const handleItemPointerDown = useCallback(
    (event: React.PointerEvent, item: VisionBoardItem) =>
      gesture.begin(event, item, { kind: "move" }),
    [gesture],
  );

  /** What a screen reader hears when an item takes focus: its kind, and for a text its words. */
  const itemLabel = useCallback(
    (item: VisionBoardItem) =>
      item.kind === "text"
        ? `${t("add_text")}: ${item.text}`
        : t(item.kind === "image" ? "add_image" : "add_sticker"),
    [t],
  );

  return (
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
        if (event.dataTransfer.files.length) onDropFiles(event.dataTransfer.files);
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
      <div className="flex w-full max-w-full flex-col items-center gap-5">
        <BoardFrame
          frame={doc.frame}
          style={{
            // `width` is explicit: the frame is a size container, and a size container has no
            // width of its own to offer a centring flex column.
            width: "100%",
            // The rows of chrome the board shares the window's height with; the welcome is one
            // more of them while it shows.
            maxWidth: `calc((100dvh - ${untouched ? 19 : 12}rem) * 1.5)`,
          }}
        >
          <BoardStage
            doc={doc}
            selectedId={selectedId}
            contentHiddenId={editingTextId}
            onSelect={onSelect}
            onItemPointerDown={handleItemPointerDown}
            onItemDoubleClick={onItemDoubleClick}
            onPointerMove={gesture.move}
            onPointerUp={gesture.end}
            itemLabel={itemLabel}
            renderOverlay={(item) =>
              item.kind === "text" && item.id === editingTextId ? (
                <BoardTextInlineEditor
                  item={item}
                  label={t("text_content")}
                  onChange={(text) => onTextChange(item.id, text)}
                  onDone={onTextDone}
                />
              ) : (
                <SelectionOverlay
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
        {untouched ? (
          <BoardWelcome onAddImage={onAddImage} onOpenTemplates={onOpenTemplates} />
        ) : null}
      </div>
    </div>
  );
}
