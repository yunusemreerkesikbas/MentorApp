"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import type { VisionBoardDoc, VisionDto } from "@mentor/types";
import { ApiClientError, coachingControllerGetVision, http } from "@mentor/api-client";
import { seededBoard } from "@/components/vision-board/board-document";
import { useMentorToast } from "@/lib/mentor-toast";
import type { BoardAction, BoardState } from "./use-board-reducer";

/**
 * Everything between the editor's document and the server: the first read, the manual save, the
 * publish, the autosave and the flush on the way out. The shell owns the document; this hook only
 * decides when it travels (`PUT /coaching/vision/board`).
 */

const AUTOSAVE_DELAY_MS = 2000;

function unwrap<T>(res: unknown): T | null {
  return ((res as { data?: T | null })?.data ?? (res as T | null)) as T | null;
}

function subtitleFor(dto: VisionDto): string | null {
  const { universityName, titleName, institutionName, cityName } = dto.targetNames;
  const primary = universityName ?? titleName ?? institutionName;
  if (primary && cityName) return `${primary} · ${cityName}`;
  return primary ?? cityName;
}

function putBoard(doc: VisionBoardDoc, keepalive = false) {
  return http("/v1/coaching/vision/board", {
    method: "PUT",
    body: JSON.stringify({ board: doc }),
    ...(keepalive ? { keepalive: true } : null),
  });
}

export function useBoardPersistence(state: BoardState, dispatch: Dispatch<BoardAction>) {
  const t = useTranslations("vision.board");
  const common = useTranslations("common");
  const toast = useMentorToast();

  const [vision, setVision] = useState<VisionDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    coachingControllerGetVision()
      .then((res) => {
        if (!active) return;
        const dto = unwrap<VisionDto>(res);
        setVision(dto);
        if (dto) {
          dispatch({ type: "load", doc: dto.board ?? seededBoard(dto, subtitleFor(dto)) });
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

  const save = useCallback(
    async (doc: VisionBoardDoc = state.doc) => {
      setSaving(true);
      try {
        await putBoard(doc);
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

  const saveNow = useCallback(async () => {
    if (await save()) toast.success({ title: t("saved") });
  }, [save, t, toast]);

  const publish = useCallback(async () => {
    const doc: VisionBoardDoc = { ...state.doc, status: "PUBLISHED" };
    dispatch({ type: "setStatus", status: "PUBLISHED" });
    if (await save(doc)) toast.success({ title: t("published") });
  }, [dispatch, save, state.doc, t, toast]);

  /*
   * Autosave: a paused edit (2s of silence) writes the draft to the server that the manual
   * "Kaydet" button already writes to — same endpoint, same DRAFT/PUBLISHED status, so a refresh
   * or a closed tab never loses more than the last couple of seconds of work. Deliberately silent
   * (no toast, no spinner): the top bar's save state already reflects `dirty`, and it clears
   * itself the moment this fires — that's feedback enough for something that "just works".
   */
  useEffect(() => {
    if (!state.dirty) return;
    const timer = setTimeout(() => {
      void putBoard(state.doc)
        .then(() => dispatch({ type: "saved" }))
        .catch(() => {
          /* Silent by design — the manual Save button and its error toast are the fallback. */
        });
    }, AUTOSAVE_DELAY_MS);
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
      void putBoard(latestDocRef.current, true)
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

  return { vision, loaded, loadError, saving, saveNow, publish };
}
