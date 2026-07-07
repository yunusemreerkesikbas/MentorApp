"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FORUM_IMAGE_MAX_BYTES, FORUM_IMAGE_MIMES, FORUM_MAX_ATTACHMENTS } from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";
import { uploadForumImage } from "@/lib/forum-attachments";

interface Picked {
  file: File;
  url: string;
}

/**
 * Shared image-picker state for forum composers (chat thread, QA question, QA answer). Owns the
 * blob-URL lifecycle (revoke on remove/reset), client-side allowlist/size/count checks, and the
 * upload-on-submit step. Callers render their own file input via the returned `fileRef`.
 */
export function useForumImagePicker() {
  const t = useTranslations("topluluk");
  const [images, setImages] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const incoming = Array.from(list);
    if (images.length + incoming.length > FORUM_MAX_ATTACHMENTS) {
      setError(t("attach_too_many", { max: FORUM_MAX_ATTACHMENTS }));
      return;
    }
    const next: Picked[] = [];
    for (const file of incoming) {
      if (!(FORUM_IMAGE_MIMES as readonly string[]).includes(file.type)) {
        setError(t("attach_unsupported"));
        return;
      }
      if (file.size > FORUM_IMAGE_MAX_BYTES) {
        setError(t("attach_too_large"));
        return;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setImages((prev) => [...prev, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx]!.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /** Upload all picked images and return the refs to send on create. */
  const uploadAll = (): Promise<AttachmentInput[]> =>
    Promise.all(images.map((p) => uploadForumImage(p.file)));

  const reset = () => {
    images.forEach((p) => URL.revokeObjectURL(p.url));
    setImages([]);
  };

  return {
    images,
    error,
    setError,
    addFiles,
    removeImage,
    uploadAll,
    reset,
    fileRef,
    atLimit: images.length >= FORUM_MAX_ATTACHMENTS,
  };
}
