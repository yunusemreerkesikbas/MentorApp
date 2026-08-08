"use client";

import { useEffect, useRef } from "react";
import type { VisionBoardTextItem } from "@mentor/types";
import { cq, FONT_STACKS } from "@/components/vision-board/board-item-view";

/**
 * Replaces the read-only text span in place while a text item is being edited — same box, same
 * transform as `TextItemView`, so nothing jumps between reading and typing.
 */

export interface BoardTextInlineEditorProps {
  item: VisionBoardTextItem;
  label: string;
  onChange: (text: string) => void;
  onDone: () => void;
}

export function BoardTextInlineEditor({ item, label, onChange, onDone }: BoardTextInlineEditorProps) {
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
