"use client";

import { useCallback, useState } from "react";
import {
  INK_DEFAULT_COLOR,
  INK_DEFAULT_TOOL,
  INK_TOOLS,
  type InkToolId,
} from "@/lib/notebook-ink";

/**
 * The pen the student is holding: which tool, what colour, how wide, how opaque.
 *
 * Its own hook because it is genuinely self-contained — nothing here reads a page, a selection or
 * anything else the shell owns. Both pages' `useInkDraw` and the floating toolbar read the same
 * four values, so there is exactly one pen no matter which leaf is being drawn on.
 */
export function useNotebookInkSettings() {
  const [tool, setTool] = useState<InkToolId>(INK_DEFAULT_TOOL);
  const [color, setColor] = useState<string>(INK_DEFAULT_COLOR);
  const [size, setSize] = useState(INK_TOOLS[INK_DEFAULT_TOOL].size);
  const [opacity, setOpacity] = useState(INK_TOOLS[INK_DEFAULT_TOOL].opacity);

  /**
   * Switching pens loads that pen's own width and opacity.
   *
   * A highlighter left at the fineliner's 4px is not a highlighter, and having to fix the sliders
   * after every switch is the kind of chore that makes people use one pen. Deliberate overrides
   * are lost on switching — the alternative is remembering a setting per tool, which is state that
   * has to be explained the first time it surprises somebody.
   */
  const changeTool = useCallback((next: InkToolId) => {
    setTool(next);
    if (next !== "eraser") {
      setSize(INK_TOOLS[next].size);
      setOpacity(INK_TOOLS[next].opacity);
    }
  }, []);

  return {
    tool,
    color,
    size,
    opacity,
    changeTool,
    setColor,
    setSize,
    setOpacity,
  };
}
