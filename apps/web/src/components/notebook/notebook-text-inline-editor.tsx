"use client";

import { useEffect, useRef } from "react";
import type { VisionBoardTextItem } from "@mentor/types";
import { FONT_STACKS } from "@/components/vision-board/board-item-view";
import { cq } from "./notebook-page-stage";

/**
 * Replaces a note's read-only render in place while it's being edited — same box, same transform,
 * so nothing jumps between reading and typing. Mirrors the vision board's
 * `BoardTextInlineEditor` exactly; the notebook exposes no font/colour controls, so this only ever
 * needs to edit the text itself.
 */

export interface NotebookTextInlineEditorProps {
  item: VisionBoardTextItem;
  label: string;
  onChange: (text: string) => void;
  onDone: () => void;
}

export function NotebookTextInlineEditor({
  item,
  label,
  onChange,
  onDone,
}: NotebookTextInlineEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={item.text}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onDone}
      // Stops the stage's move-gesture from starting on every caret placement / text selection.
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onDone();
        }
      }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        resize: "none",
        border: "none",
        outline: "2px solid var(--color-accent)",
        outlineOffset: "1px",
        background: "transparent",
        padding: 0,
        fontFamily: FONT_STACKS[item.font],
        fontSize: cq(item.size),
        fontWeight: item.bold ? 700 : 400,
        fontStyle: item.italic ? "italic" : "normal",
        color: item.color,
        textAlign: item.align,
        lineHeight: item.lineHeight,
        letterSpacing: cq(item.letterSpacing),
        whiteSpace: "pre-wrap",
      }}
    />
  );
}
