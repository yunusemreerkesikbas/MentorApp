"use client";

import { useLayoutEffect, useRef } from "react";
import { MediaImage as Image } from "@/components/media-image";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto, VisionBoardImageItem } from "@mentor/types";
import { boardImageSrc } from "@/components/vision-board/board-export-layout";

/**
 * Full-size preview for a mistake photo or a loose notebook page photo.
 */
export function NotebookImageLightbox({
  photo,
  onClose,
}: {
  photo: NotebookEntryDto | VisionBoardImageItem | null;
  onClose: () => void;
}) {
  const t = useTranslations("notebook");
  const dialog = useRef<HTMLDialogElement>(null);
  const visible = Boolean(photo?.storageKey || photo?.url);

  useLayoutEffect(() => {
    const node = dialog.current;
    if (visible && node && !node.open) node.showModal();
  }, [visible]);

  if (!photo || !visible) return null;

  return (
    <dialog
      ref={dialog}
      aria-label={"errorType" in photo ? t(`error_type.${photo.errorType}`) : t("photo_preview")}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none items-center justify-center border-0 bg-black p-4 open:flex"
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
    >
      <button
        type="button"
        aria-label={t("card_preview_close")}
        onClick={() => dialog.current?.close()}
        className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-white/15 text-white focus-visible:outline-2 focus-visible:outline-white"
      >
        <X aria-hidden size={20} />
      </button>

      <div className="relative h-[85dvh] w-full max-w-3xl">
        <Image src={photo.url ? boardImageSrc(photo.url) : null} alt="" fill className="object-contain" retryable />
      </div>
    </dialog>
  );
}
