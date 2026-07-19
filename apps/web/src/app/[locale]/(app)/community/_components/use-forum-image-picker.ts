"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  FORUM_FILE_MAX_BYTES,
  FORUM_FILE_MIMES,
  FORUM_IMAGE_MAX_BYTES,
  FORUM_IMAGE_MIMES,
  FORUM_MAX_ATTACHMENTS,
} from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";
import { uploadForumFile, uploadForumImage } from "@/lib/forum-attachments";

/** One picked attachment: an image (with a local preview URL) or a file (name/size chip). */
export type PickedAttachment =
  | { kind: "image"; file: File; url: string }
  | { kind: "file"; file: File };

/** All mimes the picker accepts, for the hidden `<input accept>`. */
export const FORUM_ATTACHMENT_ACCEPT = [...FORUM_IMAGE_MIMES, ...FORUM_FILE_MIMES].join(",");

/**
 * Shared attachment-picker state for forum composers (chat thread, QA question, QA answer). Handles
 * images (blob-URL preview) AND files (PDF/Office chip) under one shared 4-attachment limit. Owns the
 * blob-URL lifecycle (revoke on remove/reset), client-side allowlist/size/count checks, and the
 * upload-on-submit step. Callers render their own file input via the returned `fileRef`.
 */
export function useForumImagePicker() {
  const t = useTranslations("community");
  const [items, setItems] = useState<PickedAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const incoming = Array.from(list);
    if (items.length + incoming.length > FORUM_MAX_ATTACHMENTS) {
      setError(t("attach_too_many", { max: FORUM_MAX_ATTACHMENTS }));
      return;
    }
    const next: PickedAttachment[] = [];
    for (const file of incoming) {
      if ((FORUM_IMAGE_MIMES as readonly string[]).includes(file.type)) {
        if (file.size > FORUM_IMAGE_MAX_BYTES) {
          setError(t("attach_too_large"));
          return;
        }
        next.push({ kind: "image", file, url: URL.createObjectURL(file) });
      } else if ((FORUM_FILE_MIMES as readonly string[]).includes(file.type)) {
        if (file.size > FORUM_FILE_MAX_BYTES) {
          setError(t("attach_file_too_large"));
          return;
        }
        next.push({ kind: "file", file });
      } else {
        setError(t("attach_unsupported"));
        return;
      }
    }
    setItems((prev) => [...prev, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAt = (idx: number) => {
    setItems((prev) => {
      const target = prev[idx];
      if (target?.kind === "image") URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /** Upload all picked attachments and return the refs to send on create. */
  const uploadAll = (): Promise<AttachmentInput[]> =>
    Promise.all(
      items.map((p) => (p.kind === "image" ? uploadForumImage(p.file) : uploadForumFile(p.file))),
    );

  const reset = () => {
    items.forEach((p) => {
      if (p.kind === "image") URL.revokeObjectURL(p.url);
    });
    setItems([]);
  };

  return {
    items,
    error,
    setError,
    addFiles,
    removeAt,
    uploadAll,
    reset,
    fileRef,
    atLimit: items.length >= FORUM_MAX_ATTACHMENTS,
  };
}
