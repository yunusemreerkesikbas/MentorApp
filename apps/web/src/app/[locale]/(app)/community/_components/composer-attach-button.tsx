"use client";

import type { RefObject } from "react";
import { Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { FORUM_ATTACHMENT_ACCEPT } from "./use-forum-image-picker";

/**
 * The composers' attach tool (question, answer): a 40 px paperclip in the tool row and the hidden
 * file input it opens, driven by `useForumImagePicker`'s fields.
 */
export function ComposerAttachButton({
  fileRef,
  addFiles,
  atLimit,
  disabled,
}: {
  fileRef: RefObject<HTMLInputElement | null>;
  addFiles: (files: FileList | null) => void;
  atLimit: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("community");
  return (
    <>
      <button
        type="button"
        aria-label={t("attach")}
        disabled={disabled || atLimit}
        onClick={() => fileRef.current?.click()}
        className="flex size-10 items-center justify-center rounded-[var(--radius-card)] text-[var(--color-secondary)] hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-40"
      >
        <Paperclip size={18} aria-hidden />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={FORUM_ATTACHMENT_ACCEPT}
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />
    </>
  );
}
