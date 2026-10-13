"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import type { VisionBoardItem } from "@mentor/types";
import { VISION_BOARD_MAX_IMAGES } from "@mentor/validation";
import { createImageItem } from "@/components/vision-board/board-document";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  isSupportedBoardImage,
  isWithinBoardImageLimit,
  uploadBoardImage,
} from "@/lib/vision-board-images";
import type { BoardAction } from "./use-board-reducer";

/** Photos on their way onto the board: the queue, its progress and the limits that turn one away. */
export function useBoardImages(
  items: readonly VisionBoardItem[],
  dispatch: Dispatch<BoardAction>,
) {
  const t = useTranslations("vision.board");
  const toast = useMentorToast();
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  /** Local preview URLs, kept only so they can be revoked when the editor goes away. */
  const previewUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of previewUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const addImages = useCallback(
    async (files: FileList) => {
      const room = VISION_BOARD_MAX_IMAGES - items.filter((i) => i.kind === "image").length;
      if (room <= 0) {
        toast.warning({ title: t("limit_images") });
        return;
      }
      const queued = Array.from(files).slice(0, room);
      setUploadProgress({ done: 0, total: queued.length });
      try {
        for (const [index, file] of queued.entries()) {
          if (!isSupportedBoardImage(file)) {
            toast.warning({ title: t("image_unsupported") });
            setUploadProgress({ done: index + 1, total: queued.length });
            continue;
          }
          if (!isWithinBoardImageLimit(file)) {
            toast.warning({ title: t("image_too_large") });
            setUploadProgress({ done: index + 1, total: queued.length });
            continue;
          }
          const uploaded = await uploadBoardImage(file);
          previewUrls.current.push(uploaded.url);
          dispatch({
            type: "add",
            // `url` set directly on the item at creation, not merged in at render time: the item
            // carries its own url from the moment it exists, and the server (`enrich()`) sets it
            // again on every load.
            item: {
              ...createImageItem(crypto.randomUUID(), uploaded.key, items, uploaded.aspectRatio),
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
    [dispatch, items, t, toast],
  );

  return { uploadProgress, addImages };
}
