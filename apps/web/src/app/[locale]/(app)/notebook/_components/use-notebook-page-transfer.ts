"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { NotebookPageDto, NotebookPageItem } from "@mentor/types";
import type { useItemGesture } from "@/components/stage/use-item-gesture";
import {
  centredAt,
  ENTRY_LEFT,
  ENTRY_WIDTH,
  topZ,
} from "@/lib/notebook-layout";
import {
  acceptsNotebookDrag,
  readNotebookDrop,
  screenToPage,
  stageOnPage,
  type NotebookDrop,
} from "@/lib/notebook-drop";
import type { useNotebookPage } from "./use-notebook-page";
import type { Side } from "./notebook-shell-layout";

type PageHook = ReturnType<typeof useNotebookPage>;
type Gesture = ReturnType<typeof useItemGesture<NotebookPageItem>>;

/** Where a pointer has to be on a phone leaf to carry an item over: this close to the edge. */
const EDGE_ZONE_SHARE = 0.12;
const EDGE_ZONE_MIN_PX = 32;

export interface UseNotebookPageTransferOptions {
  bookRef: RefObject<HTMLDivElement | null>;
  isMobile: boolean;
  mobileSide: Side;
  setMobileSide: (side: Side) => void;
  setFocusedSide: (side: Side) => void;
  leftPage: PageHook;
  rightPage: PageHook;
  leftGesture: Gesture;
  rightGesture: Gesture;
  leftMeta: NotebookPageDto | null;
  rightMeta: NotebookPageDto | null;
  setLeftMeta: (update: (meta: NotebookPageDto | null) => NotebookPageDto | null) => void;
  setRightMeta: (update: (meta: NotebookPageDto | null) => NotebookPageDto | null) => void;
  /** An item left its page: the shell lets go of anything it held about it (the note editor). */
  onTransferred: (itemId: string) => void;
  /** Something from the side panel or the computer landed on a page, at this point on its canvas. */
  onDrop: (side: Side, drop: NotebookDrop, point: { x: number; y: number }) => void;
  /** Photo files make entries, which only the mistake notebook with an exam can hold. */
  acceptFiles: boolean;
}

interface CrossDrag {
  side: Side;
  itemId: string;
  pointerId: number;
  moved: boolean;
}

const other = (side: Side): Side => (side === "left" ? "right" : "left");

/**
 * Both open pages as one surface: an item can be carried from one to the other, and things can be
 * dropped onto either one from outside.
 *
 * Each page is still its own document with its own gesture session (`notebook-shell.tsx`), so this
 * does not merge them. It watches a move gesture and, if the pointer is released over the facing
 * page, hands the item across: removed from one document, added to the other at the spot it was
 * let go. Both pages then autosave on their own, exactly as they do for any other edit.
 *
 * On a wide screen "over the facing page" is literal. A phone shows one leaf at a time, so there the
 * edge stands in for the facing page: drag to the right edge of the left leaf, let go, and the leaf
 * turns to show the item on the right one (and back the same way).
 *
 * Everything the handlers need is read from a ref of the latest options rather than closed over, so
 * a release at the end of a long drag sees the item where the drag left it, not where it started.
 */
export function useNotebookPageTransfer(options: UseNotebookPageTransferOptions) {
  const latest = useRef(options);
  // After every commit, before any pointer or drag event can reach the handlers below.
  useLayoutEffect(() => {
    latest.current = options;
  });

  const cross = useRef<CrossDrag | null>(null);
  /** The page an item or a panel drag would land on if released now. Mirrored in a ref for handlers. */
  const [dropSide, setDropSideState] = useState<Side | null>(null);
  const dropSideRef = useRef<Side | null>(null);
  const setDropSide = useCallback((side: Side | null) => {
    if (dropSideRef.current === side) return;
    dropSideRef.current = side;
    setDropSideState(side);
  }, []);
  /** The page an item is being dragged on: it stops clipping so the item can cross the spine. */
  const [draggingSide, setDraggingSide] = useState<Side | null>(null);

  const pageBox = useCallback((side: Side) => {
    const book = latest.current.bookRef.current;
    const page = book?.querySelector<HTMLElement>(`[data-notebook-page="${side}"]`);
    const stage = page?.querySelector<HTMLElement>("[data-board-stage]");
    if (!page || !stage) return null;
    return { page: page.getBoundingClientRect(), stage: stage.getBoundingClientRect() };
  }, []);

  /** Which page a pointer at this spot would hand the dragged item to, if any. */
  const crossTarget = useCallback(
    (from: Side, clientX: number, clientY: number): Side | null => {
      const { isMobile } = latest.current;
      if (isMobile) {
        const box = pageBox(from);
        if (!box) return null;
        const zone = Math.max(EDGE_ZONE_MIN_PX, box.page.width * EDGE_ZONE_SHARE);
        if (from === "left" && clientX >= box.page.right - zone) return "right";
        if (from === "right" && clientX <= box.page.left + zone) return "left";
        return null;
      }
      const target = other(from);
      const box = pageBox(target);
      if (!box) return null;
      const { page } = box;
      return clientX >= page.left &&
        clientX <= page.right &&
        clientY >= page.top &&
        clientY <= page.bottom
        ? target
        : null;
    },
    [pageBox],
  );

  const transfer = useCallback(
    (from: Side, to: Side, itemId: string) => {
      const o = latest.current;
      const source = from === "left" ? o.leftPage : o.rightPage;
      const target = to === "left" ? o.leftPage : o.rightPage;
      const item = source.state.doc.items.find((candidate) => candidate.id === itemId);
      const sourceBox = pageBox(from);
      if (!item || !sourceBox) return;

      /*
       * Where it lands. On a wide screen both pages are on screen, so the item keeps the exact spot
       * it was let go at: its drawn centre, measured off the DOM (rotation included), re-expressed
       * on the facing page's canvas. A phone's facing leaf is not on screen to aim at, so the item
       * keeps its height and lands centred in the writing column, clear of the binding.
       */
      const drawn = o.bookRef.current
        ?.querySelector<HTMLElement>(
          `[data-notebook-page="${from}"] [data-notebook-item="${itemId}"]`,
        )
        ?.getBoundingClientRect();
      const targetBox = o.isMobile ? sourceBox : pageBox(to);
      if (!drawn || !targetBox) return;
      const centre = screenToPage(
        { x: drawn.left + drawn.width / 2, y: drawn.top + drawn.height / 2 },
        targetBox.stage,
        targetBox.page.width,
      );
      const area = stageOnPage(targetBox.stage, targetBox.page.width);
      if (o.isMobile) {
        centre.x = Math.max(
          ENTRY_LEFT + item.width / 2,
          ENTRY_LEFT + ENTRY_WIDTH / 2,
        );
      }

      const moved: NotebookPageItem = {
        ...item,
        ...centredAt(centre, item, area),
        z: topZ(target.state.doc.items) + 1,
      };
      source.dispatch({ type: "remove", id: itemId });
      target.dispatch({ type: "add", item: moved });

      // The card's entry rides along, so the facing page can draw it. It also stays where it was:
      // undo on the page it left brings the card back, and that card still needs its entry.
      if (item.kind === "entry") {
        const meta = from === "left" ? o.leftMeta : o.rightMeta;
        const entry = meta?.entries.find((candidate) => candidate.id === item.entryId);
        const setTargetMeta = to === "left" ? o.setLeftMeta : o.setRightMeta;
        if (entry) {
          setTargetMeta((current) =>
            current && !current.entries.some((candidate) => candidate.id === entry.id)
              ? { ...current, entries: [...current.entries, entry] }
              : current,
          );
        }
      }

      o.onTransferred(itemId);
      o.setFocusedSide(to);
      if (o.isMobile) o.setMobileSide(to);
    },
    [pageBox],
  );

  /** The handlers one page's stage needs, in place of its gesture's own move/up pair. */
  const stageHandlers = useCallback(
    (side: Side) => {
      const gesture = side === "left" ? latest.current.leftGesture : latest.current.rightGesture;
      return {
        onItemPointerDown: (event: ReactPointerEvent, item: NotebookPageItem) => {
          gesture.begin(event, item, { kind: "move" });
          if (event.button !== 0) return;
          cross.current = { side, itemId: item.id, pointerId: event.pointerId, moved: false };
          setDraggingSide(side);
        },
        onPointerMove: (event: ReactPointerEvent) => {
          gesture.move(event);
          const drag = cross.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          drag.moved = true;
          setDropSide(crossTarget(drag.side, event.clientX, event.clientY));
        },
        onPointerUp: (event: ReactPointerEvent) => {
          gesture.end(event);
          const drag = cross.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          cross.current = null;
          const to = dropSideRef.current;
          setDropSide(null);
          setDraggingSide(null);
          // A cancelled pointer (a system gesture took it) is not a decision to move anything.
          if (event.type === "pointercancel" || !drag.moved || !to || to === drag.side) return;
          transfer(drag.side, to, drag.itemId);
        },
      };
    },
    [crossTarget, setDropSide, transfer],
  );

  /** Drop target handlers for one page, for drags that start outside the book. */
  const dropHandlers = useCallback(
    (side: Side) => ({
      onDragOver: (event: ReactDragEvent<HTMLElement>) => {
        const files = latest.current.acceptFiles;
        if (!acceptsNotebookDrag(Array.from(event.dataTransfer.types), { files })) return;
        // Calling this is what tells the browser the page takes the drop.
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropSide(side);
      },
      onDragLeave: (event: ReactDragEvent<HTMLElement>) => {
        // Leaving for one of the page's own children is not leaving the page.
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        if (dropSideRef.current === side) setDropSide(null);
      },
      onDrop: (event: ReactDragEvent<HTMLElement>) => {
        setDropSide(null);
        const o = latest.current;
        const drop = readNotebookDrop(event.dataTransfer, { files: o.acceptFiles });
        if (!drop) return;
        event.preventDefault();
        const box = pageBox(side);
        if (!box) return;
        o.onDrop(
          side,
          drop,
          screenToPage({ x: event.clientX, y: event.clientY }, box.stage, box.page.width),
        );
      },
    }),
    [pageBox, setDropSide],
  );

  return { dropSide, draggingSide, stageHandlers, dropHandlers };
}
