"use client";

import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import type { NotebookEntryDto, NotebookPageDto } from "@mentor/types";
import { NOTEBOOK_MAX_PAGES } from "@mentor/validation";
import {
  NotebookPageSurface,
  NotebookSpine,
  PAGE_PERCENT,
  SPINE_PERCENT,
} from "@/components/notebook/notebook-surface";
import { NotebookPageCurl, type CurlDrive } from "@/components/notebook/notebook-page-curl";
import { NotebookRiffle } from "@/components/notebook/notebook-riffle";
import { NotebookStaticPage } from "@/components/notebook/notebook-static-page";
import { saveNotebookPage } from "@/lib/notebook";
import { forgetNotebookContents } from "@/lib/notebook-contents-cache";
import type { CurlGeometry, CurlPoint } from "@/lib/notebook-curl";
import { playNotebookSfx } from "@/lib/notebook-sfx";
import { EMPTY_PAGE, nextView, spreadOf, type Side, type View } from "./notebook-shell-layout";
import type { useNotebookPage } from "./use-notebook-page";
import type { useNotebookPageCache } from "./use-notebook-page-cache";

/**
 * Turning the book's pages: what turns, what it shows, and the moment the editor takes over.
 *
 * A turn is drawn entirely by an overlay (`NotebookPageCurl`, or `NotebookRiffle` for a jump from
 * the contents page) over the live spread, which stays exactly as it was until the turn ends. Then,
 * in one commit, the editor switches to where the turn ended, with the destination's pages taken
 * from the read-ahead cache: the overlay's last frame and the live spread's first are the same
 * picture, so nothing flickers between them and nothing waits for the network.
 *
 * On a wide screen a turn moves a whole spread and the leaf hinges at the coil. On a phone a turn
 * moves one page: forwards, the page curls away off its own left edge; backwards, the previous one
 * curls back in over it.
 */

type PageHook = ReturnType<typeof useNotebookPage>;
type PageCache = ReturnType<typeof useNotebookPageCache>;

export interface Place {
  view: View;
  /** Which page of the view is in front on a phone. On a wide screen both are. */
  side: Side;
}

/** Where one turn goes from `place`, or null where a turn is not the way to move (the cover). */
export function turnTarget(place: Place, delta: 1 | -1, single: boolean): Place | null {
  const { view, side } = place;
  if (view.kind === "cover") return null;
  if (single) {
    if (delta > 0 && side === "left") return { view, side: "right" };
    if (delta < 0 && side === "right") return { view, side: "left" };
  }
  const next = nextView(view, delta);
  if (next.kind === "cover") return null;
  if (next.kind === "spread" && next.left + 1 >= NOTEBOOK_MAX_PAGES) return null;
  return { view: next, side: delta > 0 ? "left" : "right" };
}

/** How many leaves a riffle to the spread at `left` flips: enough to read as "many", never slow. */
export function riffleLeaves(left: number): number {
  return Math.max(2, Math.min(6, Math.floor(left / 2) + 1));
}

/** Waits for the pages a turn lands on, but never longer than a turn is worth waiting for. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);
}

/** Lays two faces out the way the live spread lays out its pages, coil between them. */
function spreadOfFaces(left: ReactNode, right: ReactNode) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
      <div style={{ width: `${PAGE_PERCENT}%`, height: "100%" }}>{left}</div>
      <NotebookSpine />
      <div style={{ width: `${PAGE_PERCENT}%`, height: "100%" }}>{right}</div>
    </div>
  );
}

/** The coil again, drawn over the turning leaf: the leaf turns through it, not over it. */
const coilOnTop = (
  <div style={{ position: "absolute", inset: 0, display: "flex" }}>
    <div style={{ width: `${PAGE_PERCENT}%` }} />
    <NotebookSpine />
  </div>
);

/** The back of a sheet on a phone: the reverse of the page, nothing written on it. */
const blank = <NotebookPageSurface paper="plain" binding="right" coil={false} />;

export interface TurnFaces {
  insideCover: (single: boolean) => ReactNode;
  contentsPage: (single: boolean) => ReactNode;
}

export function useNotebookTurns({
  view,
  setView,
  mobileSide,
  setMobileSide,
  isMobile,
  reduceMotion,
  bookRef,
  leftPage,
  rightPage,
  leftMeta,
  rightMeta,
  setLeftMeta,
  setRightMeta,
  cache,
  notebookId,
  dueIds,
  faces,
  onPlaced,
}: {
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  mobileSide: Side;
  setMobileSide: Dispatch<SetStateAction<Side>>;
  isMobile: boolean;
  reduceMotion: boolean;
  bookRef: RefObject<HTMLElement | null>;
  leftPage: PageHook;
  rightPage: PageHook;
  leftMeta: NotebookPageDto | null;
  rightMeta: NotebookPageDto | null;
  setLeftMeta: Dispatch<SetStateAction<NotebookPageDto | null>>;
  setRightMeta: Dispatch<SetStateAction<NotebookPageDto | null>>;
  cache: PageCache;
  notebookId?: string;
  dueIds: ReadonlySet<string>;
  faces: TurnFaces;
  /** Told which spread a turn already put in place from the cache (null: it did not). */
  onPlaced: (left: number | null) => void;
}) {
  const [overlay, setOverlay] = useState<ReactNode>(null);
  const running = useRef(false);
  const seq = useRef(0);
  /** Pages turned away from before their save landed: they come back marked unsaved. */
  const unsaved = useRef(new Set<number>());

  /** The open pages go into the cache as they are now, and anything unsaved is saved now. */
  const stash = useCallback(() => {
    if (view.kind !== "spread") return;
    const open: Array<[number, PageHook, NotebookPageDto | null]> = [
      [view.left, leftPage, leftMeta],
      [view.left + 1, rightPage, rightMeta],
    ];
    for (const [index, page, meta] of open) {
      cache.put({ pageIndex: index, doc: page.state.doc, entries: meta?.entries ?? [] });
      if (!page.state.dirty) continue;
      unsaved.current.add(index);
      saveNotebookPage(index, page.state.doc, notebookId)
        .then(() => {
          unsaved.current.delete(index);
          forgetNotebookContents(notebookId);
        })
        .catch(() => undefined);
    }
  }, [view, leftPage, rightPage, leftMeta, rightMeta, cache, notebookId]);

  /** The editor moves to `target`, with its pages already in hand when the cache has them. */
  const place = useCallback(
    (target: Place, sameView: boolean) => {
      // Moving to the other page of the spread already open: its pages are the ones being edited.
      if (target.view.kind === "spread" && !sameView) {
        const { left } = target.view;
        const pages = [cache.get(left), cache.get(left + 1)];
        const [leftDto, rightDto] = pages;
        if (leftDto && rightDto) {
          setLeftMeta(leftDto);
          setRightMeta(rightDto);
          leftPage.dispatch({ type: "replace", doc: leftDto.doc, dirty: unsaved.current.has(left) });
          rightPage.dispatch({
            type: "replace",
            doc: rightDto.doc,
            dirty: unsaved.current.has(left + 1),
          });
          onPlaced(left);
        } else {
          // Blank until the read lands, never the pages that were just turned away from.
          leftPage.dispatch({ type: "replace", doc: EMPTY_PAGE });
          rightPage.dispatch({ type: "replace", doc: EMPTY_PAGE });
          setLeftMeta(null);
          setRightMeta(null);
          onPlaced(null);
        }
      }
      setView(target.view);
      setMobileSide(target.side);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch identities are stable
    [cache, setLeftMeta, setRightMeta, setView, setMobileSide, onPlaced],
  );

  const finish = useCallback(
    (target: Place | null, from: View) => {
      if (target) place(target, target.view === from);
      setOverlay(null);
      running.current = false;
    },
    [place],
  );

  const pageFace = useCallback(
    (index: number, side: Side, single: boolean): ReactNode => {
      const binding = single ? "left" : side === "left" ? "right" : "left";
      const open =
        view.kind === "spread" && index === view.left
          ? { doc: leftPage.state.doc, entries: leftMeta?.entries ?? [] }
          : view.kind === "spread" && index === view.left + 1
            ? { doc: rightPage.state.doc, entries: rightMeta?.entries ?? [] }
            : null;
      const page: { doc: NotebookPageDto["doc"]; entries: NotebookEntryDto[] } | null =
        open ?? cache.get(index);
      if (!page) return <NotebookPageSurface paper="ruled" binding={binding} coil={single} />;
      return (
        <NotebookStaticPage
          doc={page.doc}
          entries={page.entries}
          dueIds={dueIds}
          binding={binding}
          coil={single}
        />
      );
    },
    [view, leftPage.state.doc, rightPage.state.doc, leftMeta, rightMeta, cache, dueIds],
  );

  const faceOf = useCallback(
    (at: Place, single: boolean): ReactNode => {
      if (at.view.kind === "contents") {
        return at.side === "left" ? faces.insideCover(single) : faces.contentsPage(single);
      }
      if (at.view.kind === "spread") {
        return pageFace(at.view.left + (at.side === "right" ? 1 : 0), at.side, single);
      }
      return null;
    },
    [faces, pageFace],
  );


  /**
   * One turn, forwards (1) or back (-1). `drag` hands the turn to a pointer that just took the page
   * by its corner. Returns false where a turn is not the way to move (to or from the cover).
   */
  const start = useCallback(
    async (delta: 1 | -1, drag?: { pointerId: number; grab: CurlPoint }) => {
      if (running.current) return true;
      const single = isMobile;
      const from: Place = { view, side: single ? mobileSide : delta > 0 ? "right" : "left" };
      const target = turnTarget(from, delta, single);
      if (!target) return false;
      running.current = true;
      stash();

      const box = bookRef.current?.getBoundingClientRect();
      if (reduceMotion || !box || box.width <= 0) {
        if (target.view.kind === "spread") {
          await within(
            Promise.all([cache.ensure(target.view.left), cache.ensure(target.view.left + 1)]),
            1500,
          );
        }
        finish(target, view);
        return true;
      }

      // A hands-off turn waits for the pages it lands on, but only when they are not already here
      // (read ahead, nearly always): a turn that starts a frame late reads as the button lagging.
      // A drag cannot wait at all: the finger is already moving, so it goes with what is here.
      if (!drag && target.view.kind === "spread" && target.view !== view) {
        const { left } = target.view;
        if (!cache.get(left) || !cache.get(left + 1)) {
          await within(Promise.all([cache.ensure(left), cache.ensure(left + 1)]), 1500);
        }
      }

      const width = box.width;
      const height = box.height;
      let geometry: CurlGeometry;
      let ground: ReactNode;
      let front: ReactNode;
      let back: ReactNode;
      let top: ReactNode = null;
      let reverse = false;
      if (single) {
        geometry = { hingeX: 0, leafX: 0, leafWidth: width, height, side: "right" };
        back = blank;
        if (delta > 0) {
          front = faceOf(from, true);
          ground = faceOf(target, true);
        } else {
          // Backwards on a phone the previous page curls back in over the current one.
          front = faceOf(target, true);
          ground = faceOf(from, true);
          reverse = true;
        }
      } else {
        const page = (width * PAGE_PERCENT) / 100;
        const gutter = (width * SPINE_PERCENT) / 100;
        geometry =
          delta > 0
            ? { hingeX: width / 2, leafX: page + gutter, leafWidth: page, height, side: "right" }
            : { hingeX: width / 2, leafX: 0, leafWidth: page, height, side: "left" };
        const here = (side: Side) => faceOf({ view, side }, false);
        const there = (side: Side) => faceOf({ view: target.view, side }, false);
        front = here(delta > 0 ? "right" : "left");
        back = there(delta > 0 ? "left" : "right");
        ground =
          delta > 0
            ? spreadOfFaces(here("left"), there("right"))
            : spreadOfFaces(there("left"), here("right"));
        top = coilOnTop;
      }

      const drive: CurlDrive = drag
        ? { kind: "drag", pointerId: drag.pointerId, grab: drag.grab, reverse, gain: reverse ? 2 : 1 }
        : { kind: "auto", reverse, durationMs: single ? 560 : 680 };
      if (!drag) playNotebookSfx("page");
      seq.current += 1;
      setOverlay(
        <NotebookPageCurl
          key={`curl-${seq.current}`}
          geometry={geometry}
          boxRef={bookRef}
          ground={ground}
          front={front}
          back={back}
          top={top}
          drive={drive}
          lift={(single ? 90 : 150) * (geometry.leafWidth / 1080)}
          onDone={(committed) => {
            if (drag && committed) playNotebookSfx("page");
            finish(committed ? target : null, view);
          }}
        />,
      );
      return true;
    },
    [isMobile, view, mobileSide, stash, bookRef, reduceMotion, cache, finish, faceOf],
  );

  /** From the contents page straight to the spread a page lies in, riffling past the rest. */
  const jump = useCallback(
    async (pageIndex: number) => {
      if (running.current || view.kind !== "contents") return;
      running.current = true;
      const { left, side } = spreadOf(pageIndex);
      const target: Place = { view: { kind: "spread", left }, side };
      await within(Promise.all([cache.ensure(left), cache.ensure(left + 1)]), 1500);
      const box = bookRef.current?.getBoundingClientRect();
      if (reduceMotion || !box || box.width <= 0) {
        finish(target, view);
        return;
      }
      const single = isMobile;
      const count = riffleLeaves(left);
      const ruled = <NotebookPageSurface paper="ruled" binding="left" coil={single} />;
      const ruledBack = <NotebookPageSurface paper="ruled" binding="right" coil={false} />;
      const width = box.width;
      const page = (width * PAGE_PERCENT) / 100;
      const gutter = (width * SPINE_PERCENT) / 100;
      playNotebookSfx("riffle", count);
      seq.current += 1;
      setOverlay(
        <NotebookRiffle
          key={`riffle-${seq.current}`}
          hingeX={single ? 0 : width / 2}
          leafX={single ? 0 : page + gutter}
          leafWidth={single ? width : page}
          height={box.height}
          dir={1}
          count={count}
          ground={
            single
              ? faceOf(target, true)
              : spreadOfFaces(
                  faceOf({ view, side: "left" }, false),
                  faceOf({ view: target.view, side: "right" }, false),
                )
          }
          firstFront={faceOf({ view, side: "right" }, single)}
          lastBack={single ? ruled : faceOf({ view: target.view, side: "left" }, false)}
          blank={ruled}
          blankBack={ruledBack}
          top={single ? null : coilOnTop}
          onDone={() => finish(target, view)}
        />,
      );
    },
    [view, cache, bookRef, reduceMotion, isMobile, finish, faceOf],
  );

  return { overlay, turning: overlay !== null, start, jump };
}
